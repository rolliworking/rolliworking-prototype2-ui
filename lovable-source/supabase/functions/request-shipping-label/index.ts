import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShippingLabelRequest {
  estimateId: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  action?: 'get' | 'submit';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: ShippingLabelRequest = await req.json();
    const { estimateId, name, email, phone, notes, action = 'submit' } = requestBody;

    console.log(`Shipping label request for estimate ${estimateId}, action: ${action}`);

    if (!estimateId) {
      throw new Error("estimateId is required");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET action - fetch estimate data for the public form
    if (action === 'get') {
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select(`
          id,
          estimate_number,
          customer:customers (
            first_name,
            last_name,
            email,
            phone,
            mobile_phone
          )
        `)
        .eq("id", estimateId)
        .single();

      if (estimateError || !estimate) {
        console.error("Estimate not found:", estimateError);
        return new Response(
          JSON.stringify({ error: "Estimate not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          estimate: {
            id: estimate.id,
            estimate_number: estimate.estimate_number,
            customer: estimate.customer,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // SUBMIT action - add the line item
    if (!name || !email || !phone) {
      throw new Error("Name, email, and phone are required");
    }

    console.log(`Customer: ${name}, Email: ${email}, Phone: ${phone}`);

    // Verify the estimate exists
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, estimate_number, status, customer_id")
      .eq("id", estimateId)
      .single();

    if (estimateError || !estimate) {
      console.error("Estimate not found:", estimateError);
      throw new Error("Estimate not found");
    }

    console.log(`Found estimate ${estimate.estimate_number} with status ${estimate.status}`);


    // Get the highest sort_order for existing line items
    const { data: maxSortOrder } = await supabase
      .from("estimate_line_items")
      .select("sort_order")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (maxSortOrder?.[0]?.sort_order || 0) + 1;

    // Add a $0 line item for the shipping label request
    const notesContent = [
      `Requested by: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      notes ? `Customer Notes: ${notes}` : null,
      `Requested at: ${new Date().toISOString()}`
    ].filter(Boolean).join('\n');

    const { data: lineItem, error: lineItemError } = await supabase
      .from("estimate_line_items")
      .insert({
        estimate_id: estimateId,
        description: "Shipping Label Request",
        notes: notesContent,
        quantity: 1,
        unit_price: 0,
        extended_price: 0,
        taxable: false,
        line_type: "service",
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (lineItemError) {
      console.error("Failed to add line item:", lineItemError);
      throw new Error("Failed to add shipping label request");
    }

    console.log(`Added shipping label request line item: ${lineItem.id}`);

    // Send email notification to staff
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const appBaseUrl = "https://rollisuite.com";
        const estimateLink = `${appBaseUrl}/estimates/${estimateId}`;
        
        await resend.emails.send({
          from: "Rolliworks <send@quotes.rolliworks.com>",
          to: ["help@rolliworks.com"],
          subject: `Shipping Label Request - ${estimate.estimate_number}`,
          html: `
            <h2>New Shipping Label Request</h2>
            <p>A customer has requested a prepaid shipping label.</p>
            
            <h3>Estimate Details</h3>
            <ul>
              <li><strong>Estimate #:</strong> ${estimate.estimate_number}</li>
              <li><strong>Requested:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</li>
            </ul>
            
            <h3>Customer Information</h3>
            <ul>
              <li><strong>Name:</strong> ${name}</li>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Phone:</strong> ${phone}</li>
              ${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ''}
            </ul>
            
            <p style="margin-top: 20px;">
              <a href="${estimateLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Estimate
              </a>
            </p>
          `,
        });
        console.log("Staff notification email sent successfully");
      } else {
        console.warn("RESEND_API_KEY not configured, skipping email notification");
      }
    } catch (emailError) {
      console.error("Failed to send staff notification email:", emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Shipping label request submitted successfully",
        lineItemId: lineItem.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in request-shipping-label function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
