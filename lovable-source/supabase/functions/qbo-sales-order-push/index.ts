import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SalesOrderLine {
  id: string;
  part_id: string | null;
  qty_ordered: number;
  unit_price: number;
  extended_price: number;
  parts?: {
    part_number: string;
    description: string;
    qbo_item_id: string | null;
  };
}

interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  subtotal: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    company_name: string | null;
    qbo_customer_id: string | null;
  };
}

async function refreshAccessToken(supabase: any): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from("qbo_tokens")
    .select("*")
    .eq("environment", "production")
    .single();

  if (error || !tokenData) {
    throw new Error("No production token found. Run a manual sync first.");
  }

  const clientId = Deno.env.get("QBO_CLIENT_ID");
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("QBO credentials not configured");
  }

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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sales_order_id } = await req.json();

    if (!sales_order_id) {
      return new Response(
        JSON.stringify({ error: "sales_order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const realmId = Deno.env.get("QBO_REALM_ID");

    if (!realmId) {
      throw new Error("QBO_REALM_ID not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sales order with customer
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customers (id, first_name, last_name, display_name, company_name, qbo_customer_id)
      `)
      .eq("id", sales_order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Sales order not found");
    }

    // Get sales order lines
    const { data: lines, error: linesError } = await supabase
      .from("so_lines")
      .select(`
        *,
        parts (part_number, description, qbo_item_id)
      `)
      .eq("so_id", sales_order_id)
      .order("sort_order", { ascending: true });

    if (linesError) {
      throw new Error("Failed to fetch sales order lines");
    }

    const salesOrder = order as SalesOrder;
    const orderLines = (lines || []) as SalesOrderLine[];

    // Re-fetch customer to get latest qbo_customer_id (may have been just created)
    const { data: freshCustomer, error: freshCustomerError } = await supabase
      .from("customers")
      .select("qbo_customer_id")
      .eq("id", salesOrder.customer_id)
      .single();

    if (freshCustomerError || !freshCustomer) {
      throw new Error("Failed to fetch customer data");
    }

    const qboCustomerId = freshCustomer.qbo_customer_id;

    // Check if customer has QBO ID
    if (!qboCustomerId) {
      throw new Error("Customer is not synced with QuickBooks. Please sync the customer first.");
    }

    // Get access token
    const accessToken = await refreshAccessToken(supabase);

    // Build QBO Invoice payload - use ItemRef if part has qbo_item_id
    const invoiceLines = orderLines.map((line, index) => {
      const lineBase = {
        Id: String(index + 1),
        LineNum: index + 1,
        Description: line.parts?.description || `Part: ${line.parts?.part_number || 'Unknown'}`,
        Amount: line.extended_price || 0,
        DetailType: "SalesItemLineDetail",
      };

      // If we have a QBO Item ID, reference it
      if (line.parts?.qbo_item_id) {
        return {
          ...lineBase,
          SalesItemLineDetail: {
            ItemRef: { value: line.parts.qbo_item_id },
            Qty: line.qty_ordered,
            UnitPrice: line.unit_price,
          },
        };
      }

      // Fallback to description-only line
      return {
        ...lineBase,
        SalesItemLineDetail: {
          Qty: line.qty_ordered,
          UnitPrice: line.unit_price,
        },
      };
    });

    // Add shipping line if applicable
    if (salesOrder.shipping_amount && salesOrder.shipping_amount > 0) {
      invoiceLines.push({
        Id: String(invoiceLines.length + 1),
        LineNum: invoiceLines.length + 1,
        Description: "Shipping",
        Amount: salesOrder.shipping_amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: salesOrder.shipping_amount,
        },
      });
    }

    const invoicePayload = {
      CustomerRef: {
        value: qboCustomerId,
      },
      Line: invoiceLines,
      PrivateNote: salesOrder.notes || undefined,
      DocNumber: salesOrder.so_number,
    };

    console.log("Creating QBO Invoice:", JSON.stringify(invoicePayload, null, 2));

    // Create invoice in QBO
    const qboResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice?minorversion=65`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(invoicePayload),
      }
    );

    if (!qboResponse.ok) {
      const errorText = await qboResponse.text();
      console.error("QBO Error:", errorText);
      throw new Error(`QuickBooks API error: ${errorText}`);
    }

    const qboResult = await qboResponse.json();
    const qboInvoiceId = qboResult.Invoice?.Id;

    console.log("Invoice created in QBO:", qboInvoiceId);

    // Update sales order with QBO invoice ID
    if (qboInvoiceId) {
      await supabase
        .from("sales_orders")
        .update({ qbo_invoice_id: qboInvoiceId })
        .eq("id", sales_order_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        qbo_invoice_id: qboInvoiceId,
        message: "Successfully pushed to QuickBooks",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error pushing to QBO:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
