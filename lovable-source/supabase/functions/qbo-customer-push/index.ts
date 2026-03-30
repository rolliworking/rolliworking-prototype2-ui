import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerData {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  qbo_customer_id: string | null;
}

interface CustomerAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
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

  const expiresAt = new Date(tokenData.access_token_expires_at || tokenData.expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return tokenData.access_token;
  }

  // Refresh the token
  console.log("[QBO Customer Push] Refreshing access token...");
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
      access_token_expires_at: newExpiresAt.toISOString(),
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
    const { customer_id } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: "customer_id is required" }),
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

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error("Customer not found");
    }

    const customerData = customer as CustomerData;

    // Check if customer already has QBO ID
    if (customerData.qbo_customer_id) {
      console.log("[QBO Customer Push] Customer already synced:", customerData.qbo_customer_id);
      return new Response(
        JSON.stringify({
          success: true,
          qbo_customer_id: customerData.qbo_customer_id,
          message: "Customer already synced with QuickBooks",
          already_synced: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer addresses
    const { data: addresses } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customer_id);

    const billingAddr = (addresses || []).find((a: any) => a.address_type === "billing") as CustomerAddress | undefined;
    const shippingAddr = (addresses || []).find((a: any) => a.address_type === "shipping") as CustomerAddress | undefined;

    // Get access token
    const accessToken = await refreshAccessToken(supabase);

    // Build QBO Customer payload
    const displayName = customerData.display_name || 
      `${customerData.first_name} ${customerData.last_name}`.trim() ||
      customerData.company_name ||
      "Unknown Customer";

    const qboCustomerPayload: any = {
      DisplayName: displayName,
      GivenName: customerData.first_name,
      FamilyName: customerData.last_name,
    };

    if (customerData.company_name) {
      qboCustomerPayload.CompanyName = customerData.company_name;
    }

    if (customerData.email) {
      qboCustomerPayload.PrimaryEmailAddr = { Address: customerData.email };
    }

    if (customerData.phone) {
      qboCustomerPayload.PrimaryPhone = { FreeFormNumber: customerData.phone };
    }

    if (customerData.mobile_phone) {
      qboCustomerPayload.Mobile = { FreeFormNumber: customerData.mobile_phone };
    }

    if (customerData.website) {
      qboCustomerPayload.WebAddr = { URI: customerData.website };
    }

    // Add billing address
    if (billingAddr?.street1 || customerData.address) {
      qboCustomerPayload.BillAddr = {
        Line1: billingAddr?.street1 || customerData.address || undefined,
        Line2: billingAddr?.street2 || undefined,
        City: billingAddr?.city || customerData.city || undefined,
        CountrySubDivisionCode: billingAddr?.state || customerData.state || undefined,
        PostalCode: billingAddr?.zip || customerData.zip || undefined,
        Country: billingAddr?.country || "US",
      };
    }

    // Add shipping address if different
    if (shippingAddr?.street1) {
      qboCustomerPayload.ShipAddr = {
        Line1: shippingAddr.street1,
        Line2: shippingAddr.street2 || undefined,
        City: shippingAddr.city || undefined,
        CountrySubDivisionCode: shippingAddr.state || undefined,
        PostalCode: shippingAddr.zip || undefined,
        Country: shippingAddr.country || "US",
      };
    }

    if (customerData.notes) {
      qboCustomerPayload.Notes = customerData.notes;
    }

    console.log("[QBO Customer Push] Creating QBO Customer:", JSON.stringify(qboCustomerPayload, null, 2));

    // Create customer in QBO
    const qboResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer?minorversion=65`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(qboCustomerPayload),
      }
    );

    if (!qboResponse.ok) {
      const errorText = await qboResponse.text();
      console.error("[QBO Customer Push] QBO Error:", errorText);
      
      // Check for duplicate name error
      if (errorText.includes("Duplicate Name Exists")) {
        throw new Error("A customer with this name already exists in QuickBooks. Please check for duplicates.");
      }
      
      throw new Error(`QuickBooks API error: ${errorText}`);
    }

    const qboResult = await qboResponse.json();
    const qboCustomerId = qboResult.Customer?.Id;

    console.log("[QBO Customer Push] Customer created in QBO:", qboCustomerId);

    // Update local customer with QBO ID
    if (qboCustomerId) {
      const { error: updateError } = await supabase
        .from("customers")
        .update({ qbo_customer_id: qboCustomerId })
        .eq("id", customer_id);

      if (updateError) {
        console.error("[QBO Customer Push] Failed to update local customer:", updateError);
        // Don't throw - the QBO customer was created successfully
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        qbo_customer_id: qboCustomerId,
        message: "Successfully created customer in QuickBooks",
        already_synced: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[QBO Customer Push] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
