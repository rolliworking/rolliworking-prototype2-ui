import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_API_PRODUCTION = 'https://quickbooks.api.intuit.com/v3/company';
const FALLBACK_API_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  context: string
): Promise<{ response: Response; intuit_tid?: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      const intuit_tid = response.headers.get('intuit_tid') || undefined;
      if (intuit_tid) {
        console.log(`[QBO Cron] ${context} intuit_tid: ${intuit_tid}`);
      }
      if (response.ok || response.status < 500) {
        return { response, intuit_tid };
      }
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    } catch (e) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
      if (attempt === MAX_RETRIES - 1) {
        throw e;
      }
    }
  }
  throw new Error(`${context} failed after ${MAX_RETRIES} attempts`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('QBO_CLIENT_ID');
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
  const realmId = Deno.env.get('QBO_REALM_ID');

  if (!clientId || !clientSecret || !realmId) {
    console.error('[QBO Cron] Missing QBO credentials');
    return new Response(JSON.stringify({ success: false, error: 'Missing QBO credentials' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const sync_type = (body as any)?.sync_type || 'both'; // 'customer', 'estimate', or 'both'
    const environment = (body as any)?.environment || 'production';

    console.log(`[QBO Cron] Starting ${sync_type} sync for ${environment} environment`);

    // Get stored refresh token
    const { data: tokenData, error: tokenError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .eq('realm_id', realmId)
      .eq('environment', environment)
      .single();

    if (tokenError || !tokenData) {
      console.error('[QBO Cron] No stored token found:', tokenError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'No stored refresh token. Please run a manual sync first to initialize.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const refreshToken = tokenData.refresh_token;
    const QBO_API_BASE = environment === 'sandbox' ? FALLBACK_API_SANDBOX : FALLBACK_API_PRODUCTION;

    // Exchange refresh token for access token
    console.log('[QBO Cron] Exchanging refresh token...');
    const { response: tokenResponse } = await fetchWithRetry(
      FALLBACK_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
      'Token exchange'
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[QBO Cron] Token exchange failed:', errorText);
      
      // Update token record with error
      await supabase
        .from('qbo_tokens')
        .update({
          last_sync_status: 'failed',
          last_sync_error: 'Token refresh failed - reconnection required',
        })
        .eq('id', tokenData.id);

      return new Response(JSON.stringify({
        success: false,
        error: 'Token refresh failed. Please reconnect via manual sync.',
        requiresReconnect: true,
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newTokenData = await tokenResponse.json();
    const accessToken = newTokenData.access_token;
    const newRefreshToken = newTokenData.refresh_token;

    // Save new refresh token immediately
    await supabase
      .from('qbo_tokens')
      .update({
        refresh_token: newRefreshToken,
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      })
      .eq('id', tokenData.id);

    console.log('[QBO Cron] Token refreshed and saved');

    const results: { customer?: any; estimate?: any } = {};

    // Sync customers
    if (sync_type === 'customer' || sync_type === 'both') {
      const logEntry = await supabase
        .from('qbo_sync_log')
        .insert({
          sync_type: 'customer',
          environment,
          status: 'started',
          triggered_by: 'cron',
        })
        .select()
        .single();

      try {
        const customerResult = await syncCustomers(supabase, QBO_API_BASE, realmId, accessToken);
        results.customer = customerResult;

        await supabase
          .from('qbo_sync_log')
          .update({
            status: 'success',
            records_created: customerResult.created,
            records_updated: customerResult.updated,
            records_skipped: customerResult.skipped,
            intuit_tids: customerResult.intuit_tids,
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.data?.id);

        console.log(`[QBO Cron] Customer sync complete: ${customerResult.created} created, ${customerResult.updated} updated`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        await supabase
          .from('qbo_sync_log')
          .update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.data?.id);
        results.customer = { error: errorMsg };
      }
    }

    // Sync estimates (last 7 days for daily sync)
    if (sync_type === 'estimate' || sync_type === 'both') {
      const logEntry = await supabase
        .from('qbo_sync_log')
        .insert({
          sync_type: 'estimate',
          environment,
          status: 'started',
          triggered_by: 'cron',
        })
        .select()
        .single();

      try {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const startDate = weekAgo.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        const estimateResult = await syncEstimates(supabase, QBO_API_BASE, realmId, accessToken, startDate, endDate);
        results.estimate = estimateResult;

        await supabase
          .from('qbo_sync_log')
          .update({
            status: 'success',
            records_created: estimateResult.created,
            records_updated: estimateResult.updated,
            records_skipped: estimateResult.skipped,
            intuit_tids: estimateResult.intuit_tids,
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.data?.id);

        console.log(`[QBO Cron] Estimate sync complete: ${estimateResult.created} created, ${estimateResult.updated} updated`);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        await supabase
          .from('qbo_sync_log')
          .update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', logEntry.data?.id);
        results.estimate = { error: errorMsg };
      }
    }

    // Update token last sync info
    await supabase
      .from('qbo_tokens')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_type: sync_type,
        last_sync_status: 'success',
        last_sync_error: null,
      })
      .eq('id', tokenData.id);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[QBO Cron] Error:', errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Customer sync function
async function syncCustomers(
  supabase: any,
  apiBase: string,
  realmId: string,
  accessToken: string
): Promise<{ created: number; updated: number; skipped: number; total: number; intuit_tids: string[] }> {
  const result = { created: 0, updated: 0, skipped: 0, total: 0, intuit_tids: [] as string[] };
  const pageSize = 1000;
  let startPosition = 1;
  let hasMore = true;
  const allCustomers: any[] = [];

  while (hasMore) {
    const query = encodeURIComponent(
      `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`
    );
    const { response, intuit_tid } = await fetchWithRetry(
      `${apiBase}/${realmId}/query?query=${query}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } },
      `Customer fetch (page ${startPosition})`
    );

    if (intuit_tid) result.intuit_tids.push(intuit_tid);
    if (!response.ok) throw new Error(`Customer fetch failed: ${response.status}`);

    const data = await response.json();
    const customers = data.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      hasMore = false;
    } else {
      allCustomers.push(...customers);
      startPosition += pageSize;
      if (customers.length < pageSize) hasMore = false;
    }
    await sleep(100);
  }

  result.total = allCustomers.length;

  // Upsert customers
  for (const c of allCustomers) {
    const customerData = {
      qbo_customer_id: c.Id,
      first_name: c.GivenName || c.DisplayName?.split(' ')[0] || 'Unknown',
      last_name: c.FamilyName || c.DisplayName?.split(' ').slice(1).join(' ') || '',
      display_name: c.DisplayName || '',
      company_name: c.CompanyName || null,
      email: c.PrimaryEmailAddr?.Address || null,
      phone: c.PrimaryPhone?.FreeFormNumber || null,
      mobile_phone: c.Mobile?.FreeFormNumber || null,
      address: c.BillAddr?.Line1 || null,
      city: c.BillAddr?.City || null,
      state: c.BillAddr?.CountrySubDivisionCode || null,
      zip: c.BillAddr?.PostalCode || null,
    };

    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('qbo_customer_id', c.Id)
      .single();

    if (existing) {
      await supabase.from('customers').update(customerData).eq('id', existing.id);
      result.updated++;
    } else {
      await supabase.from('customers').insert(customerData);
      result.created++;
    }
  }

  return result;
}

// Estimate sync function
async function syncEstimates(
  supabase: any,
  apiBase: string,
  realmId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ created: number; updated: number; skipped: number; total: number; customersCreated: number; intuit_tids: string[] }> {
  const result = { created: 0, updated: 0, skipped: 0, total: 0, customersCreated: 0, intuit_tids: [] as string[] };
  const pageSize = 1000;
  let startPosition = 1;
  let hasMore = true;
  const allEstimates: any[] = [];

  while (hasMore) {
    const query = encodeURIComponent(
      `SELECT * FROM Estimate WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`
    );
    const { response, intuit_tid } = await fetchWithRetry(
      `${apiBase}/${realmId}/query?query=${query}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } },
      `Estimate fetch (page ${startPosition})`
    );

    if (intuit_tid) result.intuit_tids.push(intuit_tid);
    if (!response.ok) throw new Error(`Estimate fetch failed: ${response.status}`);

    const data = await response.json();
    const estimates = data.QueryResponse?.Estimate || [];
    if (estimates.length === 0) {
      hasMore = false;
    } else {
      allEstimates.push(...estimates);
      startPosition += pageSize;
      if (estimates.length < pageSize) hasMore = false;
    }
    await sleep(100);
  }

  result.total = allEstimates.length;
  if (allEstimates.length === 0) return result;

  // Get customer map
  const qboCustomerIds = [...new Set(allEstimates.map(e => e.CustomerRef?.value).filter(Boolean))];
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('id, qbo_customer_id')
    .in('qbo_customer_id', qboCustomerIds);

  const customerMap = new Map<string, string>();
  (existingCustomers || []).forEach((c: any) => {
    if (c.qbo_customer_id) customerMap.set(c.qbo_customer_id, c.id);
  });

  // Get existing estimates
  const docNumbers = allEstimates.map(e => e.DocNumber).filter(Boolean);
  const { data: existingEstimates } = await supabase
    .from('estimates')
    .select('id, estimate_number')
    .in('estimate_number', docNumbers);

  const estimateMap = new Map<string, string>();
  (existingEstimates || []).forEach((e: any) => {
    estimateMap.set(e.estimate_number, e.id);
  });

  // Process estimates
  for (const est of allEstimates) {
    const customerId = customerMap.get(est.CustomerRef?.value || '');
    if (!customerId) {
      result.skipped++;
      continue;
    }

    const estimateNumber = est.DocNumber || `QBO-${est.Id}`;
    const existingId = estimateMap.get(estimateNumber);

    const serviceLines = (est.Line || []).filter((l: any) => l.DetailType === 'SalesItemLineDetail');
    const subtotal = serviceLines.reduce((sum: number, l: any) => sum + (l.Amount || 0), 0);

    const estimateData = {
      estimate_number: estimateNumber,
      customer_id: customerId,
      status: est.EmailStatus === 'EmailSent' ? 'sent' : 'draft',
      subtotal,
      tax_amount: est.TxnTaxDetail?.TotalTax || 0,
      total_amount: est.TotalAmt || 0,
      valid_until: est.ExpirationDate || null,
      notes: est.CustomerMemo?.value || null,
      internal_notes: est.PrivateNote || null,
    };

    if (existingId) {
      await supabase.from('estimates').update(estimateData).eq('id', existingId);
      result.updated++;
    } else {
      const { data: newEst } = await supabase.from('estimates').insert(estimateData).select().single();
      if (newEst) {
        estimateMap.set(estimateNumber, newEst.id);
        result.created++;

        // Insert line items
        const lineItems = serviceLines.map((line: any, idx: number) => ({
          estimate_id: newEst.id,
          description: line.Description || line.SalesItemLineDetail?.ItemRef?.name || 'Item',
          quantity: line.SalesItemLineDetail?.Qty || 1,
          unit_price: line.SalesItemLineDetail?.UnitPrice || line.Amount || 0,
          extended_price: line.Amount || 0,
          taxable: line.SalesItemLineDetail?.TaxCodeRef?.value !== 'NON',
          line_type: 'service',
          sort_order: idx,
        }));

        if (lineItems.length > 0) {
          await supabase.from('estimate_line_items').insert(lineItems);
        }
      }
    }
  }

  return result;
}
