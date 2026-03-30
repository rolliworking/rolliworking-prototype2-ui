// RolliSuite Documentation Content
// This is the knowledge base for the AI Q&A feature and the documentation page

export const DOCUMENTATION = {
  overview: `
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
`,

  modules: {
    estimates: `
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
Customize email communications in **Estimates → Email Templates**:
- Estimate sent email
- Intake received email
- Work complete notifications

### Job Templates
Pre-configure common service combinations in **Estimates → Job Templates** for quick estimate creation (e.g., "Complete Service", "Battery Replacement", "Water Resistance Test").
`,

    intake: `
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
Generate personalized intake emails at **Intake → Email**:
- Auto-populates customer and watch information
- Includes shipping instructions
- Tracks when emails are sent

### Inspections Queue
View watches awaiting inspection at **Intake → Inspections**:
- Watches that have been received but not yet inspected
- Add inspection notes and photos
- Update condition assessment

### Receive Watch
Log incoming watches at **Intake → Receive Watch**:
- Scan or enter tracking numbers
- Assign bin locations
- Print intake labels with QR codes
- Record chain of custody

### Client Property Tracking
All received watches are tracked in **Inventory → Client Property**:
- Current custody status (In Custody / Released)
- Location in shop
- Link to estimate and job
- Custody history
`,

    inventory: `
## Inventory Module

### Parts Management
Found at **Inventory → Parts**:
- Create and edit parts with part numbers, descriptions, costs
- Track stock levels across bins/locations
- Set reorder points and preferred vendors
- View total stock, allocated, and available quantities
- Import parts from CSV files

### Calibers
Manage watch calibers at **Inventory → Calibers**:
- Catalog movement types and specifications
- Link compatible parts to calibers
- Track frequency, jewels, power reserve

### Reorder Alerts
Monitor low stock at **Inventory → Reorder Alerts**:
- Automatic alerts when stock hits reorder point
- Create purchase orders directly from alerts
- Supplier suggestions based on purchase history

### Cycle Count
Physical inventory counting at **Inventory → Cycle Count**:
- Create count documents for specific bins/locations
- Mobile scanning interface
- Record variances and adjustments
- Approve and post counts

### Quick Move
Rapid stock transfers at **Inventory → Quick Move**:
- Move parts between bins instantly
- Scan or search parts
- Maintains full audit trail

### Client Property
Track customer watches at **Inventory → Client Property**:
- View all watches currently in custody
- Filter by status, customer, or date
- Print labels and update locations
`,

    purchasing: `
## Purchasing Module

### Purchase Orders
Create and manage POs at **Purchasing → Purchase Orders**:
- Create from scratch or from reorder suggestions
- Add line items with parts, quantities, and costs
- Issue to vendors via email or print
- Track order status (Draft, Issued, Partial, Received)

### Draft POs
Quick access to POs in draft status for editing before issuing.

### Issued POs
Track POs that have been sent to vendors and are awaiting receipt.

### Receiving
Process incoming shipments at **Purchasing → Receiving**:
- Match receipts to POs
- Record quantities received
- Handle partial receipts
- Update inventory automatically

### Vendors
Manage supplier information at **Purchasing → Vendors**:
- Contact information and addresses
- Payment terms and lead times
- Vendor-specific part pricing
- Performance tracking

### Vendor Drafts
Stage new vendors before activating them in the system.

### Reorder Drafts
AI-suggested reorder quantities based on:
- Current stock levels
- Historical usage
- Lead times
- Minimum order quantities

### Disassembly Orders
Special PO type for watch disassembly:
- Bill of Materials (BOM) for each watch model
- Track expected parts yield
- Record actual parts recovered
`,

    sales: `
## Sales Module

### Sales Orders
Track billable work at **Sales → Sales Orders**:
- Link to estimates and jobs
- Add parts used and services performed
- Calculate totals with tax
- Mark as fulfilled when complete
- Webhook integration for external systems
`,

    labels: `
## Labels Module

### Label Generation
Create and print labels at **Labels**:
- **Part Labels**: Barcode labels for inventory parts
- **Intake Labels**: QR code labels for received watches
- **Location Labels**: Bin and shelf labels

### Barcode Types
- Code 128 for part numbers
- QR codes for watches (encode customer, serial, estimate info)

### Print Options
- ZPL format for Zebra printers
- PDF for standard printers
- Batch printing support
`,

    reports: `
## Reports Module

### Analytics Dashboard
Comprehensive metrics at **Reports → Analytics**:

**Time Periods**
- Today, This Week, This Month, Last 30 Days
- Last 90 Days, This Year, All Time
- Custom date ranges

**Key Metrics**
- New leads and conversion rates
- Estimates sent and approved
- Revenue and average job value
- Shop time and efficiency

**Conversion Funnel**
- Lead → Label request rate
- Label → Received rate
- Received → Job conversion
- Time between stages

### Inventory Valuation
Track inventory value at **Reports → Inventory**:
- Total stock value at cost
- Value by location/bin
- Slow-moving inventory
- Dead stock identification

### Transaction Reports
Detailed transaction history at **Reports → Transactions**:
- Inventory adjustments
- Stock movements
- Purchase receipts
- Sales history
`,

    setup: `
## Setup & Administration

### QuickBooks Integration
Configure QBO sync at **Setup → QBO**:
- **Account Mappings**: Map service categories to QBO accounts
- **Customer Sync**: Push/pull customer data
- **Estimate Sync**: Export estimates to QBO
- **Sync Status**: Monitor sync health and errors

### Stores & Locations
Multi-location support at **Setup → Stores & Locations**:
- Define physical locations
- Create bins within locations
- Set default locations for new stock

### Users & Roles
User management at **Setup → Users & Roles**:

**Roles**
- **Admin**: Full access, can manage users and settings
- **Manager**: Can approve POs, manage inventory, view reports
- **Office**: Customer-facing, estimates, intake, sales
- **Technician**: Limited to assigned jobs, time tracking

**Permissions**
- View/Create/Edit/Delete for each module
- Approval thresholds
- Report access levels

### Email Templates
Customize system emails at **Setup → Email Templates**:
- Estimate notifications
- Intake confirmations
- Shipping label requests
- Custom variables and formatting

### Security Settings
Configure security at **Setup → Security**:
- Password policies
- Session timeouts
- MFA settings
- Audit log retention

### Company Settings
Configure company info at **Setup → Settings**:
- Company name and logo
- Default tax rate
- Business hours
- Currency and locale
`
  },

  database: `
## Database Schema

### Core Tables

**customers**
- Customer contact information
- Organization/individual flag
- Parent customer relationships
- QBO sync ID

**customer_addresses**
- Billing and shipping addresses
- Same-as-billing flag

**watches**
- Brand, model, serial number, reference number
- Link to customer
- Condition notes

**estimates**
- Customer and watch reference
- Status tracking
- Totals and tax amounts
- Validity period

**estimate_line_items**
- Services and parts
- Pricing and quantities
- Taxable flag
- Link to parts or service subcategories

**jobs**
- Created from converted estimates
- Status workflow (estimate → on_hand → finished → closed)
- Due dates and priority
- Assigned technician

**client_property**
- Custody tracking for customer watches
- Bin location
- Date received/released
- Label printing status

### Inventory Tables

**parts**
- Part number, description
- Cost and retail pricing
- UOM and reorder points
- Brand/category classification

**inventory_stock**
- Part + bin combination
- Quantity on hand, allocated, on order
- Last count date

**bins**
- Physical storage locations
- Link to parent location

**locations**
- Store or warehouse

### Purchasing Tables

**vendors**
- Vendor information
- Payment terms, lead times

**purchase_orders**
- PO header with vendor, dates, status

**po_lines**
- Line items on POs

**po_receipts** / **po_receipt_lines**
- Receipt documents and line details

### Reference Tables

**service_categories** / **service_subcategories**
- Service catalog structure
- Pricing defaults

**calibers** / **caliber_parts**
- Watch movement specifications
- Compatible parts

**model_references**
- Part number to watch model mapping

### System Tables

**user_roles**
- User role assignments

**audit_log**
- All entity changes

**settings**
- System configuration

**qbo_tokens** / **qbo_sync_log**
- QuickBooks integration state
`,

  workflows: `
## Common Workflows

### New Customer Estimate Flow
1. Customer submits inquiry (website, phone, email)
2. Lead appears in **Requests** queue
3. Staff creates estimate with watch details and services
4. Estimate sent to customer via email
5. Customer requests shipping label (if remote)
6. Watch received and logged in custody
7. Inspection completed, estimate finalized
8. Customer approves, estimate converts to job
9. Work performed, tracked in shop time
10. Job completed, sales order created
11. Watch returned to customer

### Receiving a Watch
1. Go to **Intake → Receive Watch**
2. Enter or scan tracking number
3. Search for matching estimate/customer
4. Confirm watch details
5. Assign bin location
6. Print intake label
7. Watch appears in Client Property

### Creating a Purchase Order
1. Go to **Purchasing → Purchase Orders**
2. Click "New Purchase Order"
3. Select vendor
4. Add line items (parts, quantities)
5. Review and save as draft
6. Issue to vendor when ready
7. Receive against PO when shipment arrives

### Cycle Counting
1. Go to **Inventory → Cycle Count**
2. Create new count for bin or location
3. Open mobile scanner view
4. Scan parts and enter counted quantities
5. Review variances
6. Approve and post count
7. Inventory automatically adjusted

### End-of-Day Reconciliation
1. Review **Reports → Analytics** for daily metrics
2. Check open estimates needing follow-up
3. Verify all receipts posted
4. Review reorder alerts
5. Generate QuickBooks sync if needed
`,

  troubleshooting: `
## Troubleshooting

### Common Issues

**"I can't delete this estimate"**
- Estimates with related jobs cannot be deleted
- Archive instead by changing status to expired

**"Customer not showing in search"**
- Check for typos in name
- Try searching by email or phone
- Customer may need to be activated if imported

**"Inventory quantity is wrong"**
- Check allocated quantities (reserved for jobs)
- Review recent adjustments in audit log
- Run cycle count to verify physical stock

**"QuickBooks sync failed"**
- Check sync status page for error details
- Verify QBO connection in settings
- Ensure account mappings are complete
- Check for duplicate customers in QBO

**"Can't print labels"**
- Verify printer is connected
- Check label format matches printer type
- For ZPL, ensure Zebra printer drivers are installed

**"Email not sending"**
- Verify email templates are configured
- Check customer has valid email address
- Review sent emails in activity log

### Error Messages

**"Permission denied"**
- Your role doesn't have access to this feature
- Contact an admin to adjust permissions

**"Record not found"**
- Item may have been deleted by another user
- Refresh the page and try again

**"Validation error"**
- Required fields are missing
- Check highlighted fields for specific errors

### Getting Help
- Check this documentation first
- Use the AI Search feature to find answers
- Contact your system administrator
`
};

// Function to get all documentation as a single string for AI context
export function getFullDocumentation(): string {
  return `
${DOCUMENTATION.overview}

${DOCUMENTATION.modules.estimates}

${DOCUMENTATION.modules.intake}

${DOCUMENTATION.modules.inventory}

${DOCUMENTATION.modules.purchasing}

${DOCUMENTATION.modules.sales}

${DOCUMENTATION.modules.labels}

${DOCUMENTATION.modules.reports}

${DOCUMENTATION.modules.setup}

${DOCUMENTATION.database}

${DOCUMENTATION.workflows}

${DOCUMENTATION.troubleshooting}
  `.trim();
}

// Export individual sections for the documentation page
export const DOCUMENTATION_SECTIONS = [
  { id: 'overview', title: 'Overview', content: DOCUMENTATION.overview },
  { id: 'estimates', title: 'Estimates', content: DOCUMENTATION.modules.estimates },
  { id: 'intake', title: 'Intake', content: DOCUMENTATION.modules.intake },
  { id: 'inventory', title: 'Inventory', content: DOCUMENTATION.modules.inventory },
  { id: 'purchasing', title: 'Purchasing', content: DOCUMENTATION.modules.purchasing },
  { id: 'sales', title: 'Sales', content: DOCUMENTATION.modules.sales },
  { id: 'labels', title: 'Labels', content: DOCUMENTATION.modules.labels },
  { id: 'reports', title: 'Reports', content: DOCUMENTATION.modules.reports },
  { id: 'setup', title: 'Setup', content: DOCUMENTATION.modules.setup },
  { id: 'database', title: 'Database Schema', content: DOCUMENTATION.database },
  { id: 'workflows', title: 'Workflows', content: DOCUMENTATION.workflows },
  { id: 'troubleshooting', title: 'Troubleshooting', content: DOCUMENTATION.troubleshooting },
];
