-- =============================================
-- ROLLIPARTS: Core Inventory Management Schema
-- =============================================

-- Enums
CREATE TYPE public.uom_type AS ENUM ('ea', 'hr', 'box', 'set', 'lb', 'oz', 'ft', 'in');
CREATE TYPE public.item_type AS ENUM ('inventory', 'non_inventory', 'service', 'client_property', 'assembly');
CREATE TYPE public.po_status AS ENUM ('draft', 'issued', 'partial_received', 'received', 'cancelled');
CREATE TYPE public.so_status AS ENUM ('draft', 'open', 'partial_fulfilled', 'fulfilled', 'cancelled');
CREATE TYPE public.transfer_status AS ENUM ('pending', 'in_transit', 'completed', 'cancelled');
CREATE TYPE public.adjustment_type AS ENUM ('cycle_count', 'shrinkage', 'damage', 'correction', 'disassembly', 'assembly');

-- =============================================
-- STORES / LOCATIONS / BINS
-- =============================================
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE TABLE public.bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, name)
);

-- =============================================
-- VENDORS (Extended from existing)
-- =============================================
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  website TEXT,
  notes TEXT,
  payment_terms TEXT,
  lead_time_days INTEGER DEFAULT 7,
  min_order_qty INTEGER,
  min_order_amount NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  qbo_vendor_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- PARTS / ITEMS MASTER
-- =============================================
CREATE TABLE public.parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  item_type item_type NOT NULL DEFAULT 'inventory',
  uom uom_type NOT NULL DEFAULT 'ea',
  
  -- Costing
  average_cost NUMERIC(12,4) DEFAULT 0,
  last_cost NUMERIC(12,4),
  lowest_cost NUMERIC(12,4),
  highest_cost NUMERIC(12,4),
  
  -- Pricing
  default_sell_price NUMERIC(12,2),
  
  -- Reorder settings
  reorder_point INTEGER DEFAULT 0,
  reorder_qty INTEGER DEFAULT 1,
  min_qty INTEGER DEFAULT 0,
  max_qty INTEGER,
  
  -- Default location
  default_bin_id UUID REFERENCES public.bins(id),
  
  -- Tracking
  is_serialized BOOLEAN NOT NULL DEFAULT false,
  track_lot BOOLEAN NOT NULL DEFAULT false,
  
  -- Category/Classification
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  
  -- QBO Integration
  qbo_item_id TEXT,
  qbo_income_account TEXT,
  qbo_cogs_account TEXT,
  qbo_asset_account TEXT,
  
  -- Misc
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vendor-specific part info (cross-ref table)
CREATE TABLE public.vendor_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_part_number TEXT,
  vendor_description TEXT,
  vendor_cost NUMERIC(12,4),
  vendor_uom TEXT,
  vendor_pack_qty INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  min_order_qty INTEGER,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(part_id, vendor_id)
);

-- Alternate/Misc SKUs for parts
CREATE TABLE public.part_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  alias_type TEXT NOT NULL DEFAULT 'misc',
  alias_sku TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(alias_sku)
);

-- =============================================
-- CLIENT PROPERTY (Serialized Watches)
-- =============================================
CREATE TABLE public.client_property (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  job_id UUID REFERENCES public.jobs(id),
  
  -- Watch details
  brand TEXT NOT NULL,
  model TEXT,
  reference_number TEXT,
  serial_number TEXT NOT NULL,
  
  -- Inventory tracking
  bin_id UUID REFERENCES public.bins(id),
  date_received TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date_released TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_in_inventory BOOLEAN NOT NULL DEFAULT true,
  
  -- Labels
  label_printed BOOLEAN NOT NULL DEFAULT false,
  label_printed_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INVENTORY STOCK
-- =============================================
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  bin_id UUID NOT NULL REFERENCES public.bins(id) ON DELETE CASCADE,
  
  qty_on_hand NUMERIC(12,4) NOT NULL DEFAULT 0,
  qty_allocated NUMERIC(12,4) NOT NULL DEFAULT 0,
  qty_on_order NUMERIC(12,4) NOT NULL DEFAULT 0,
  
  -- Computed available = on_hand - allocated
  
  last_count_date TIMESTAMP WITH TIME ZONE,
  last_count_qty NUMERIC(12,4),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(part_id, bin_id)
);

-- Inventory adjustments log
CREATE TABLE public.inventory_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  bin_id UUID NOT NULL REFERENCES public.bins(id),
  adjustment_type adjustment_type NOT NULL,
  qty_before NUMERIC(12,4) NOT NULL,
  qty_after NUMERIC(12,4) NOT NULL,
  qty_change NUMERIC(12,4) NOT NULL,
  cost_per_unit NUMERIC(12,4),
  total_cost_impact NUMERIC(12,4),
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  adjusted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- BILL OF MATERIALS (BOM)
-- =============================================
CREATE TABLE public.bom_headers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  bom_name TEXT NOT NULL,
  description TEXT,
  is_disassembly BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_part_id, bom_name)
);

CREATE TABLE public.bom_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_header_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
  component_part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE RESTRICT,
  qty NUMERIC(12,4) NOT NULL DEFAULT 1,
  uom uom_type NOT NULL DEFAULT 'ea',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- PURCHASE ORDERS
-- =============================================
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  status po_status NOT NULL DEFAULT 'draft',
  
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,
  
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  duty_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Landed cost allocation
  allocate_shipping BOOLEAN NOT NULL DEFAULT true,
  
  notes TEXT,
  
  -- Source tracking (e.g., eBay import)
  source TEXT,
  source_reference TEXT,
  
  created_by UUID,
  qbo_bill_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.po_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  
  qty_ordered NUMERIC(12,4) NOT NULL,
  qty_received NUMERIC(12,4) NOT NULL DEFAULT 0,
  
  unit_cost NUMERIC(12,4) NOT NULL,
  extended_cost NUMERIC(12,2) NOT NULL,
  
  -- Landed cost per unit (after allocation)
  landed_cost_per_unit NUMERIC(12,4),
  
  -- If this is a disassembly purchase
  bom_header_id UUID REFERENCES public.bom_headers(id),
  
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Receiving records
CREATE TABLE public.po_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.po_receipt_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.po_receipts(id) ON DELETE CASCADE,
  po_line_id UUID NOT NULL REFERENCES public.po_lines(id),
  part_id UUID NOT NULL REFERENCES public.parts(id),
  bin_id UUID NOT NULL REFERENCES public.bins(id),
  
  qty_received NUMERIC(12,4) NOT NULL,
  actual_cost NUMERIC(12,4),
  
  serial_number TEXT,
  lot_number TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- SALES ORDERS
-- =============================================
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  job_id UUID REFERENCES public.jobs(id),
  
  status so_status NOT NULL DEFAULT 'draft',
  
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ship_date DATE,
  
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  notes TEXT,
  
  created_by UUID,
  qbo_invoice_id TEXT,
  
  -- Webhook tracking
  work_completed_sent BOOLEAN NOT NULL DEFAULT false,
  work_completed_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.so_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  
  qty_ordered NUMERIC(12,4) NOT NULL,
  qty_allocated NUMERIC(12,4) NOT NULL DEFAULT 0,
  qty_shipped NUMERIC(12,4) NOT NULL DEFAULT 0,
  
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,4),
  extended_price NUMERIC(12,2) NOT NULL,
  
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INVENTORY TRANSFERS
-- =============================================
CREATE TABLE public.inventory_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  
  from_bin_id UUID NOT NULL REFERENCES public.bins(id),
  to_bin_id UUID NOT NULL REFERENCES public.bins(id),
  
  status transfer_status NOT NULL DEFAULT 'pending',
  
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_date TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.transfer_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  qty NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CYCLE COUNTS
-- =============================================
CREATE TABLE public.cycle_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  count_number TEXT NOT NULL UNIQUE,
  bin_id UUID REFERENCES public.bins(id),
  location_id UUID REFERENCES public.locations(id),
  store_id UUID REFERENCES public.stores(id),
  
  status TEXT NOT NULL DEFAULT 'draft',
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_by UUID,
  posted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.cycle_count_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_count_id UUID NOT NULL REFERENCES public.cycle_counts(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  bin_id UUID NOT NULL REFERENCES public.bins(id),
  
  system_qty NUMERIC(12,4) NOT NULL,
  counted_qty NUMERIC(12,4),
  variance_qty NUMERIC(12,4),
  variance_cost NUMERIC(12,4),
  
  counted_at TIMESTAMP WITH TIME ZONE,
  counted_by UUID,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- OUTBOUND EVENTS (Webhook to Rolliworking)
-- =============================================
CREATE TYPE public.outbound_event_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE public.outbound_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  job_id TEXT,
  
  payload JSONB NOT NULL,
  
  status outbound_event_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  response_code INTEGER,
  response_body TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(reference_type, reference_id, event_type)
);

-- =============================================
-- RECEIVED WEBHOOK EVENTS (From Rolliworking)
-- =============================================
CREATE TYPE public.received_webhook_status AS ENUM ('received', 'processed', 'duplicate', 'failed');

CREATE TABLE public.received_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  job_id TEXT,
  sales_order_id UUID,
  
  raw_payload JSONB NOT NULL,
  
  status received_webhook_status NOT NULL DEFAULT 'received',
  error TEXT,
  
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- QBO SYNC LOG
-- =============================================
CREATE TABLE public.qbo_daily_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_date DATE NOT NULL,
  
  inventory_asset_debit NUMERIC(12,2) DEFAULT 0,
  inventory_asset_credit NUMERIC(12,2) DEFAULT 0,
  cogs_debit NUMERIC(12,2) DEFAULT 0,
  cogs_credit NUMERIC(12,2) DEFAULT 0,
  
  entry_count INTEGER DEFAULT 0,
  notes TEXT,
  
  synced_to_qbo BOOLEAN NOT NULL DEFAULT false,
  qbo_journal_id TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(journal_date)
);

-- =============================================
-- SETTINGS UPDATES
-- =============================================
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS rolliworking_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS rolliworking_api_key TEXT,
ADD COLUMN IF NOT EXISTS rolliworking_timeout_seconds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS incoming_webhook_api_key TEXT,
ADD COLUMN IF NOT EXISTS qbo_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_store_id UUID REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS next_po_number INTEGER DEFAULT 1001,
ADD COLUMN IF NOT EXISTS next_so_number INTEGER DEFAULT 1001,
ADD COLUMN IF NOT EXISTS next_transfer_number INTEGER DEFAULT 1001,
ADD COLUMN IF NOT EXISTS next_count_number INTEGER DEFAULT 1001;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_parts_part_number ON public.parts(part_number);
CREATE INDEX idx_parts_category ON public.parts(category);
CREATE INDEX idx_parts_item_type ON public.parts(item_type);
CREATE INDEX idx_vendor_parts_vendor ON public.vendor_parts(vendor_id);
CREATE INDEX idx_part_aliases_sku ON public.part_aliases(alias_sku);
CREATE INDEX idx_inventory_stock_part ON public.inventory_stock(part_id);
CREATE INDEX idx_inventory_stock_bin ON public.inventory_stock(bin_id);
CREATE INDEX idx_client_property_serial ON public.client_property(serial_number);
CREATE INDEX idx_client_property_customer ON public.client_property(customer_id);
CREATE INDEX idx_po_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);
CREATE INDEX idx_so_customer ON public.sales_orders(customer_id);
CREATE INDEX idx_so_status ON public.sales_orders(status);
CREATE INDEX idx_outbound_events_status ON public.outbound_events(status, next_attempt_at);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_property ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.so_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_daily_journal ENABLE ROW LEVEL SECURITY;

-- Authenticated user policies (all tables)
CREATE POLICY "Authenticated users can view stores" ON public.stores FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage stores" ON public.stores FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

CREATE POLICY "Authenticated users can view locations" ON public.locations FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage locations" ON public.locations FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

CREATE POLICY "Authenticated users can view bins" ON public.bins FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage bins" ON public.bins FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

CREATE POLICY "Authenticated users can view vendors" ON public.vendors FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create vendors" ON public.vendors FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated users can update vendors" ON public.vendors FOR UPDATE USING (is_authenticated());
CREATE POLICY "Admins can delete vendors" ON public.vendors FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view parts" ON public.parts FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create parts" ON public.parts FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated users can update parts" ON public.parts FOR UPDATE USING (is_authenticated());
CREATE POLICY "Admins can delete parts" ON public.parts FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view vendor_parts" ON public.vendor_parts FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage vendor_parts" ON public.vendor_parts FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view part_aliases" ON public.part_aliases FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage part_aliases" ON public.part_aliases FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view client_property" ON public.client_property FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create client_property" ON public.client_property FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated users can update client_property" ON public.client_property FOR UPDATE USING (is_authenticated());
CREATE POLICY "Admins can delete client_property" ON public.client_property FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view inventory_stock" ON public.inventory_stock FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage inventory_stock" ON public.inventory_stock FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view inventory_adjustments" ON public.inventory_adjustments FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create inventory_adjustments" ON public.inventory_adjustments FOR INSERT WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can view bom_headers" ON public.bom_headers FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage bom_headers" ON public.bom_headers FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view bom_lines" ON public.bom_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage bom_lines" ON public.bom_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view purchase_orders" ON public.purchase_orders FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create purchase_orders" ON public.purchase_orders FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated users can update purchase_orders" ON public.purchase_orders FOR UPDATE USING (is_authenticated());
CREATE POLICY "Admins can delete purchase_orders" ON public.purchase_orders FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view po_lines" ON public.po_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage po_lines" ON public.po_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view po_receipts" ON public.po_receipts FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage po_receipts" ON public.po_receipts FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view po_receipt_lines" ON public.po_receipt_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage po_receipt_lines" ON public.po_receipt_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view sales_orders" ON public.sales_orders FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can create sales_orders" ON public.sales_orders FOR INSERT WITH CHECK (is_authenticated());
CREATE POLICY "Authenticated users can update sales_orders" ON public.sales_orders FOR UPDATE USING (is_authenticated());
CREATE POLICY "Admins can delete sales_orders" ON public.sales_orders FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view so_lines" ON public.so_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage so_lines" ON public.so_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view inventory_transfers" ON public.inventory_transfers FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage inventory_transfers" ON public.inventory_transfers FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view transfer_lines" ON public.transfer_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage transfer_lines" ON public.transfer_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view cycle_counts" ON public.cycle_counts FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage cycle_counts" ON public.cycle_counts FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view cycle_count_lines" ON public.cycle_count_lines FOR SELECT USING (is_authenticated());
CREATE POLICY "Authenticated users can manage cycle_count_lines" ON public.cycle_count_lines FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view outbound_events" ON public.outbound_events FOR SELECT USING (is_authenticated());
CREATE POLICY "System can manage outbound_events" ON public.outbound_events FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view received_webhook_events" ON public.received_webhook_events FOR SELECT USING (is_authenticated());
CREATE POLICY "System can manage received_webhook_events" ON public.received_webhook_events FOR ALL USING (is_authenticated());

CREATE POLICY "Authenticated users can view qbo_daily_journal" ON public.qbo_daily_journal FOR SELECT USING (is_authenticated());
CREATE POLICY "Managers can manage qbo_daily_journal" ON public.qbo_daily_journal FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin', 'manager']::app_role[]));

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bins_updated_at BEFORE UPDATE ON public.bins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_parts_updated_at BEFORE UPDATE ON public.vendor_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_property_updated_at BEFORE UPDATE ON public.client_property FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_stock_updated_at BEFORE UPDATE ON public.inventory_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bom_headers_updated_at BEFORE UPDATE ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_transfers_updated_at BEFORE UPDATE ON public.inventory_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cycle_counts_updated_at BEFORE UPDATE ON public.cycle_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outbound_events_updated_at BEFORE UPDATE ON public.outbound_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_next_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings SET next_po_number = next_po_number + 1 RETURNING next_po_number - 1 INTO next_num;
  RETURN 'PO-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_so_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings SET next_so_number = next_so_number + 1 RETURNING next_so_number - 1 INTO next_num;
  RETURN 'SO-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_transfer_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings SET next_transfer_number = next_transfer_number + 1 RETURNING next_transfer_number - 1 INTO next_num;
  RETURN 'TR-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_count_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings SET next_count_number = next_count_number + 1 RETURNING next_count_number - 1 INTO next_num;
  RETURN 'CC-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- Function to search parts by any SKU (part_number, vendor part, alias)
CREATE OR REPLACE FUNCTION public.search_parts(search_term TEXT)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  description TEXT,
  match_type TEXT,
  matched_value TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.part_number, p.description, 'part_number'::TEXT, p.part_number
  FROM public.parts p
  WHERE p.part_number ILIKE '%' || search_term || '%'
  
  UNION
  
  SELECT p.id, p.part_number, p.description, 'vendor_part'::TEXT, vp.vendor_part_number
  FROM public.parts p
  JOIN public.vendor_parts vp ON vp.part_id = p.id
  WHERE vp.vendor_part_number ILIKE '%' || search_term || '%'
  
  UNION
  
  SELECT p.id, p.part_number, p.description, 'alias'::TEXT, pa.alias_sku
  FROM public.parts p
  JOIN public.part_aliases pa ON pa.part_id = p.id
  WHERE pa.alias_sku ILIKE '%' || search_term || '%'
$$;

-- Insert default store
INSERT INTO public.stores (name, address) VALUES ('Main Warehouse', 'Rolliworks HQ') ON CONFLICT DO NOTHING;