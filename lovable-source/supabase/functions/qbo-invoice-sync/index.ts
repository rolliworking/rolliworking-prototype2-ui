import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QBOInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance?: number;
  CustomerRef?: { value: string; name?: string };
  Line?: Array<{
    Description?: string;
    Amount?: number;
    DetailType?: string;
    SalesItemLineDetail?: { Qty?: number; UnitPrice?: number; ItemRef?: { name?: string } };
  }>;
  CustomerMemo?: { value?: string };
}

async function refreshAccessToken(supabase: any, environment: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from("qbo_tokens")
    .select("*")
    .eq("environment", environment)
    .single();

  if (error || !tokenData) {
    throw new Error(`No ${environment} token found. Run a manual sync first.`);
  }

  const clientId = Deno.env.get("QBO_CLIENT_ID");
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("QBO credentials not configured");
  }

  // Check if token needs refresh (expires in < 5 minutes)
  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return tokenData.access_token;
  }

  // Refresh the token
  const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase
    .from("qbo_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenData.id);

  return tokens.access_token;
}

async function fetchQBOInvoices(
  accessToken: string,
  realmId: string,
  startDate: string,
  endDate: string,
  environment: string
): Promise<QBOInvoice[]> {
  const baseUrl = environment === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";

  const query = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
  const encodedQuery = encodeURIComponent(query);

  console.log(`Fetching invoices from ${startDate} to ${endDate}`);

  const response = await fetch(
    `${baseUrl}/v3/company/${realmId}/query?query=${encodedQuery}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.QueryResponse?.Invoice || [];
}

function calculateIsEditable(invoiceDate: string, forceEditable: boolean): boolean {
  if (forceEditable) return true;
  // Default: read-only (not editable) unless explicitly forced
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { 
      environment = "production", 
      start_date, 
      end_date, 
      force_editable = false,
      months_back = 12  // fallback if no date range provided
    } = body;

    const realmId = Deno.env.get("QBO_REALM_ID");
    if (!realmId) {
      throw new Error("QBO_REALM_ID not configured");
    }

    // Log sync start
    const { data: logEntry } = await supabase
      .from("qbo_sync_log")
      .insert({
        sync_type: "invoice",
        environment,
        status: "started",
        triggered_by: "manual",
      })
      .select()
      .single();

    const accessToken = await refreshAccessToken(supabase, environment);

    // Calculate date range - prefer explicit dates, fallback to months_back
    let startDateStr: string;
    let endDateStr: string;

    if (start_date && end_date) {
      startDateStr = start_date;
      endDateStr = end_date;
    } else {
      endDateStr = new Date().toISOString().split("T")[0];
      const startDateObj = new Date();
      startDateObj.setMonth(startDateObj.getMonth() - months_back);
      startDateStr = startDateObj.toISOString().split("T")[0];
    }
    
    console.log(`Sync params: start=${startDateStr}, end=${endDateStr}, forceEditable=${force_editable}`);

    const invoices = await fetchQBOInvoices(accessToken, realmId, startDateStr, endDateStr, environment);

    console.log(`Fetched ${invoices.length} invoices from QBO`);

    // Preload customer mapping (QBO CustomerRef.value -> local customer UUID)
    const qboCustomerIds = Array.from(
      new Set(invoices.map((i) => i.CustomerRef?.value).filter((v): v is string => !!v))
    );

    const customerByQboId = new Map<string, any>();

    if (qboCustomerIds.length > 0) {
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, qbo_customer_id, display_name, first_name, last_name, company_name")
        .in("qbo_customer_id", qboCustomerIds);

      if (customersError) {
        console.warn("Failed to preload customers for invoice mapping:", customersError.message);
      } else {
        for (const c of customers || []) {
          if (c.qbo_customer_id) customerByQboId.set(c.qbo_customer_id, c);
        }
      }
    }

    let created = 0;
    let updated = 0;

    for (const invoice of invoices) {
      const isEditable = calculateIsEditable(invoice.TxnDate, force_editable);

      const customerQboId = invoice.CustomerRef?.value ?? null;
      const mappedCustomer = customerQboId ? customerByQboId.get(customerQboId) : null;

      const resolvedCustomerName =
        mappedCustomer?.display_name ||
        `${mappedCustomer?.first_name || ""} ${mappedCustomer?.last_name || ""}`.trim() ||
        mappedCustomer?.company_name ||
        invoice.CustomerRef?.name ||
        null;

      const lineItems = invoice.Line
        ?.filter((l) => l.DetailType === "SalesItemLineDetail")
        .map((l) => ({
          description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || "",
          quantity: l.SalesItemLineDetail?.Qty || 1,
          unit_price: l.SalesItemLineDetail?.UnitPrice || 0,
          amount: l.Amount || 0,
        }));

      const invoiceRecord = {
        qbo_invoice_id: invoice.Id,
        doc_number: invoice.DocNumber,
        customer_name: resolvedCustomerName,
        customer_qbo_id: customerQboId,
        customer_id: mappedCustomer?.id ?? null,
        invoice_date: invoice.TxnDate,
        due_date: invoice.DueDate,
        total_amount: invoice.TotalAmt,
        balance: invoice.Balance || 0,
        status: (invoice.Balance || 0) > 0 ? "open" : "paid",
        line_items: lineItems,
        memo: invoice.CustomerMemo?.value,
        is_editable: isEditable,
        raw_data: invoice,
        synced_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("qbo_invoices")
        .select("id")
        .eq("qbo_invoice_id", invoice.Id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("qbo_invoices")
          .update(invoiceRecord)
          .eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("qbo_invoices").insert(invoiceRecord);
        created++;
      }
    }

    // Update sync log
    await supabase
      .from("qbo_sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        records_created: created,
        records_updated: updated,
      })
      .eq("id", logEntry?.id);

    // Update token last sync
    await supabase
      .from("qbo_tokens")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_type: "invoice",
        last_sync_error: null,
      })
      .eq("environment", environment);

    console.log(`Invoice sync complete: ${created} created, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        invoices_fetched: invoices.length,
        created,
        updated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Invoice sync error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
