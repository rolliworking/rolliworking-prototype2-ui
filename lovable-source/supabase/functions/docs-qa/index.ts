import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Full documentation content embedded in the edge function
const DOCUMENTATION = `
# RolliSuite - Watch Repair Shop Management System

RolliSuite is a comprehensive management system designed specifically for watch repair shops. It handles the complete workflow from customer inquiries to completed repairs, including inventory management, purchasing, and QuickBooks integration.

## Key Features
- **Customer & Estimate Management**: Track customer information, create and send estimates
- **Intake Workflow**: Manage shipping labels, receive watches, and track custody
- **Inventory & Parts**: Full inventory management with stock levels, reorder alerts, and cycle counting
- **Purchasing**: Purchase orders, vendor management, and receiving
- **Sales Orders**: Track work orders and billable services
- **Labels & Printing**: Generate barcodes, QR codes, and intake labels
- **Analytics & Reports**: Conversion funnels, revenue tracking, and performance metrics
- **QuickBooks Integration**: Sync customers, estimates, and products with QBO
- **Multi-User Support**: Role-based access control (Admin, Manager, Office, Technician)

## Estimates Module

### Overview
The Estimates module is the starting point for customer work. An estimate becomes a job when the customer approves the work.

### Creating an Estimate
1. Go to **Estimates → All Estimates** or click the + button in the Estimates menu
2. Select or create a customer
3. Add watch information (brand, model, serial number, reference number)
4. Add line items using service templates or individual services/parts
5. Save and optionally send to customer via email

### Estimate Statuses
- **Draft**: Not yet sent to customer
- **Sent**: Emailed to customer, awaiting response
- **Converted**: Customer approved, converted to job
- **Expired**: Past validity date
- **Declined**: Customer declined the estimate

### Email Templates
Customize email communications in **Estimates → Email Templates**.

### Job Templates
Pre-configure common service combinations in **Estimates → Job Templates** for quick estimate creation (e.g., "Complete Service", "Battery Replacement").

## Intake Module

### Overview
The Intake module manages the process of receiving customer watches and tracking custody.

### Intake Leads (Requests)
Found at **Estimates → Requests**:
- Incoming service requests from website forms
- Email inquiries
- Phone call logging
- Convert leads to estimates with one click

### Email Intake
Generate personalized intake emails at **Intake → Email**.

### Inspections Queue
View watches awaiting inspection at **Intake → Inspections**.

### Receive Watch
Log incoming watches at **Intake → Receive Watch**:
- Scan or enter tracking numbers
- Assign bin locations
- Print intake labels with QR codes
- Record chain of custody

### Client Property Tracking
All received watches are tracked in **Inventory → Client Property**.

## Inventory Module

### Parts Management
Found at **Inventory → Parts**:
- Create and edit parts with part numbers, descriptions, costs
- Track stock levels across bins/locations
- Set reorder points and preferred vendors
- Import parts from CSV files

### Calibers
Manage watch calibers at **Inventory → Calibers**.

### Reorder Alerts
Monitor low stock at **Inventory → Reorder Alerts**.

### Cycle Count
Physical inventory counting at **Inventory → Cycle Count**:
- Create count documents for specific bins/locations
- Mobile scanning interface
- Record variances and adjustments

### Quick Move
Rapid stock transfers at **Inventory → Quick Move**.

### Client Property
Track customer watches at **Inventory → Client Property**.

## Purchasing Module

### Purchase Orders
Create and manage POs at **Purchasing → Purchase Orders**:
- Create from scratch or from reorder suggestions
- Add line items with parts, quantities, and costs
- Issue to vendors via email or print
- Track order status (Draft, Issued, Partial, Received)

### Vendors
Manage supplier information at **Purchasing → Vendors**.

### Reorder Drafts
AI-suggested reorder quantities based on stock levels and usage.

### Disassembly Orders
Special PO type for watch disassembly with Bill of Materials.

## Sales Module

### Sales Orders
Track billable work at **Sales → Sales Orders**:
- Link to estimates and jobs
- Add parts used and services performed
- Calculate totals with tax
- Webhook integration for external systems

## Labels Module

Create and print labels at **Labels**:
- **Part Labels**: Barcode labels for inventory parts
- **Intake Labels**: QR code labels for received watches
- **Location Labels**: Bin and shelf labels
- ZPL format for Zebra printers
- PDF for standard printers

## Reports Module

### Analytics Dashboard
Comprehensive metrics at **Reports → Analytics**:
- New leads and conversion rates
- Estimates sent and approved
- Revenue and average job value
- Conversion funnel tracking

## Setup & Administration

### QuickBooks Integration
Configure QBO sync at **Setup → QBO**:
- Account Mappings
- Customer Sync
- Estimate Sync
- Sync Status

### Users & Roles
User management at **Setup → Users & Roles**:

**Roles**
- **Admin**: Full access, can manage users and settings
- **Manager**: Can approve POs, manage inventory, view reports
- **Office**: Customer-facing, estimates, intake, sales
- **Technician**: Limited to assigned jobs, time tracking

### Security Settings
Configure at **Setup → Security**:
- Password policies
- MFA settings

## Common Workflows

### New Customer Estimate Flow
1. Customer submits inquiry (website, phone, email)
2. Lead appears in Requests queue
3. Staff creates estimate with watch details and services
4. Estimate sent to customer via email
5. Customer requests shipping label (if remote)
6. Watch received and logged in custody
7. Inspection completed, estimate finalized
8. Customer approves, estimate converts to job
9. Work performed
10. Job completed, sales order created
11. Watch returned to customer

### Receiving a Watch
1. Go to **Intake → Receive Watch**
2. Enter or scan tracking number
3. Search for matching estimate/customer
4. Confirm watch details
5. Assign bin location
6. Print intake label

### Creating a Purchase Order
1. Go to **Purchasing → Purchase Orders**
2. Click "New Purchase Order"
3. Select vendor
4. Add line items
5. Save as draft
6. Issue to vendor when ready
7. Receive against PO when shipment arrives

### Cycle Counting
1. Go to **Inventory → Cycle Count**
2. Create new count for bin or location
3. Open mobile scanner view
4. Scan parts and enter counted quantities
5. Review variances
6. Approve and post count

## Troubleshooting

### Common Issues

**"I can't delete this estimate"**
- Estimates with related jobs cannot be deleted
- Archive instead by changing status to expired

**"Customer not showing in search"**
- Check for typos in name
- Try searching by email or phone

**"Inventory quantity is wrong"**
- Check allocated quantities (reserved for jobs)
- Review recent adjustments in audit log
- Run cycle count to verify physical stock

**"QuickBooks sync failed"**
- Check sync status page for error details
- Verify QBO connection in settings
- Ensure account mappings are complete

**"Can't print labels"**
- Verify printer is connected
- Check label format matches printer type

**"Email not sending"**
- Verify email templates are configured
- Check customer has valid email address

### Error Messages

**"Permission denied"**
- Your role doesn't have access to this feature
- Contact an admin to adjust permissions

**"Record not found"**
- Item may have been deleted by another user
- Refresh the page and try again
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a helpful assistant for RolliSuite, a watch repair shop management system. 
Your job is to answer questions about how to use the software based on the documentation provided.

Guidelines:
- Be concise and helpful
- Reference specific menu paths like "Estimates → All Estimates"
- If you're not sure about something, say so
- Format your response with markdown for readability
- If the question is about something not in the documentation, politely explain that you can only answer questions about RolliSuite features

Documentation:
${DOCUMENTATION}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I couldn't generate an answer. Please try rephrasing your question.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("docs-qa error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
