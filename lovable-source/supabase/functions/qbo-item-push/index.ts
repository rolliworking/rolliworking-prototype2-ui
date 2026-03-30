import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Part {
  id: string;
  part_number: string;
  description: string;
  default_sell_price: number | null;
  average_cost: number | null;
  item_type: string;
  qbo_item_id: string | null;
  qbo_income_account: string | null;
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
    const { part_ids } = await req.json();

    if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "part_ids array is required" }),
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

    // Get parts that need to be pushed (don't have qbo_item_id)
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("id, part_number, description, default_sell_price, average_cost, item_type, qbo_item_id, qbo_income_account")
      .in("id", part_ids);

    if (partsError) {
      throw new Error("Failed to fetch parts: " + partsError.message);
    }

    // Filter to only parts without QBO ID
    const partsToSync = (parts || []).filter((p: Part) => !p.qbo_item_id);

    if (partsToSync.length === 0) {
      console.log("[QBO Item Push] All parts already synced to QBO");
      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: 0, 
          skipped: parts?.length || 0,
          message: "All parts already synced to QuickBooks" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const accessToken = await refreshAccessToken(supabase);
    
    const results: { part_id: string; qbo_item_id: string | null; error?: string }[] = [];

    // Push each part to QBO
    for (const part of partsToSync as Part[]) {
      try {
        // Determine item type for QBO
        const isService = part.item_type === 'service' || part.item_type === 'non_inventory';
        const qboType = isService ? "Service" : "NonInventory";

        // Build QBO Item payload
        const itemPayload: any = {
          Name: part.part_number.substring(0, 100), // QBO limits to 100 chars
          Type: qboType,
          Description: part.description?.substring(0, 4000) || part.part_number,
          UnitPrice: part.default_sell_price || 0,
          Taxable: false,
          Active: true,
        };

        // Add income account if specified
        if (part.qbo_income_account) {
          itemPayload.IncomeAccountRef = { value: part.qbo_income_account };
        }

        // Add cost for non-service items
        if (!isService && part.average_cost) {
          itemPayload.PurchaseCost = part.average_cost;
        }

        console.log(`[QBO Item Push] Creating item: ${part.part_number}`, JSON.stringify(itemPayload));

        // Create item in QBO
        const qboResponse = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${realmId}/item?minorversion=65`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(itemPayload),
          }
        );

        if (!qboResponse.ok) {
          const errorText = await qboResponse.text();
          console.error(`[QBO Item Push] QBO Error for ${part.part_number}:`, errorText);
          
          // Check for duplicate name
          if (errorText.includes("Duplicate Name Exists") || errorText.includes("already been used")) {
            // Try to find the existing item by name
            const searchResponse = await fetch(
              `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Name = '${part.part_number.replace(/'/g, "\\'")}'`)}&minorversion=65`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              }
            );

            if (searchResponse.ok) {
              const searchResult = await searchResponse.json();
              const existingItem = searchResult.QueryResponse?.Item?.[0];
              if (existingItem?.Id) {
                console.log(`[QBO Item Push] Found existing item ${existingItem.Id} for ${part.part_number}`);
                
                // Update local part with existing QBO ID
                await supabase
                  .from("parts")
                  .update({ qbo_item_id: existingItem.Id })
                  .eq("id", part.id);

                results.push({ part_id: part.id, qbo_item_id: existingItem.Id });
                continue;
              }
            }
          }
          
          results.push({ part_id: part.id, qbo_item_id: null, error: errorText });
          continue;
        }

        const qboResult = await qboResponse.json();
        const qboItemId = qboResult.Item?.Id;

        console.log(`[QBO Item Push] Item created: ${part.part_number} -> ${qboItemId}`);

        // Update local part with QBO ID
        if (qboItemId) {
          await supabase
            .from("parts")
            .update({ qbo_item_id: qboItemId })
            .eq("id", part.id);
        }

        results.push({ part_id: part.id, qbo_item_id: qboItemId });
      } catch (itemError: any) {
        console.error(`[QBO Item Push] Error for ${part.part_number}:`, itemError);
        results.push({ part_id: part.id, qbo_item_id: null, error: itemError.message });
      }
    }

    const successCount = results.filter(r => r.qbo_item_id).length;
    const errorCount = results.filter(r => r.error).length;

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        errors: errorCount,
        skipped: (parts?.length || 0) - partsToSync.length,
        results,
        message: `Pushed ${successCount} items to QuickBooks${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[QBO Item Push] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
