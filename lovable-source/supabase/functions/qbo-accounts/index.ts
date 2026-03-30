import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intuit endpoints
const DISCOVERY_DOC_URL = 'https://developer.api.intuit.com/.well-known/openid_configuration';
const FALLBACK_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_API_PRODUCTION = 'https://quickbooks.api.intuit.com/v3/company';
const FALLBACK_API_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  CurrentBalance?: number;
}

interface DiscoveryDocument {
  token_endpoint: string;
}

// Fetch discovery document
async function getDiscoveryDocument(): Promise<DiscoveryDocument> {
  try {
    console.log('[QBO Accounts] Fetching discovery document...');
    const response = await fetch(DISCOVERY_DOC_URL);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('[QBO Accounts] Discovery fetch failed, using fallback:', e);
  }
  return { token_endpoint: FALLBACK_TOKEN_URL };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const use_sandbox = Boolean(body?.use_sandbox);
    const account_type = body?.account_type; // Optional filter

    const clientId = Deno.env.get('QBO_CLIENT_ID');
    const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
    const realmId = Deno.env.get('QBO_REALM_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !realmId) {
      throw new Error('QBO credentials not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get stored token from database
    const environment = use_sandbox ? 'sandbox' : 'production';
    const { data: tokenData, error: tokenError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .eq('realm_id', realmId)
      .eq('environment', environment)
      .single();

    if (tokenError || !tokenData?.refresh_token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No stored token found',
        requiresReconnect: true,
        message: 'Please run a manual sync first to store the token.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh the access token
    const discovery = await getDiscoveryDocument();
    const tokenUrl = discovery.token_endpoint;

    console.log('[QBO Accounts] Refreshing access token...');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[QBO Accounts] Token refresh failed:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: 'Token refresh failed',
        requiresReconnect: true,
        message: 'Your QuickBooks connection has expired. Please reconnect.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newTokenData = await tokenResponse.json();
    const accessToken = newTokenData.access_token;
    const newRefreshToken = newTokenData.refresh_token;

    // Save the new refresh token
    await supabase
      .from('qbo_tokens')
      .update({
        refresh_token: newRefreshToken,
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('realm_id', realmId)
      .eq('environment', environment);

    console.log('[QBO Accounts] Token refreshed and saved');

    // Fetch accounts from QBO
    const QBO_API_BASE = use_sandbox ? FALLBACK_API_SANDBOX : FALLBACK_API_PRODUCTION;
    
    // Build query - fetch all active accounts
    let query = "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000";
    if (account_type) {
      query = `SELECT * FROM Account WHERE Active = true AND AccountType = '${account_type}' MAXRESULTS 1000`;
    }
    
    const queryUrl = `${QBO_API_BASE}/${realmId}/query?query=${encodeURIComponent(query)}`;
    
    console.log('[QBO Accounts] Fetching accounts...');
    const accountsResponse = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('[QBO Accounts] Failed to fetch accounts:', errorText);
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts: QBOAccount[] = accountsData.QueryResponse?.Account || [];

    console.log(`[QBO Accounts] Fetched ${accounts.length} accounts`);

    // Group accounts by type for easier selection
    const groupedAccounts: Record<string, QBOAccount[]> = {};
    accounts.forEach(account => {
      const type = account.AccountType;
      if (!groupedAccounts[type]) {
        groupedAccounts[type] = [];
      }
      groupedAccounts[type].push(account);
    });

    // Sort within each group
    Object.values(groupedAccounts).forEach(group => {
      group.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
    });

    return new Response(JSON.stringify({
      success: true,
      accounts,
      groupedAccounts,
      total: accounts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[QBO Accounts] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
