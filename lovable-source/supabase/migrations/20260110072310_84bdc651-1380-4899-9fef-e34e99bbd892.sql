-- ===================================================
-- ROLLIPARTS EXTENDED FEATURES SCHEMA
-- Movement/Caliber Database, Reorder Alerts, Label Printing
-- ===================================================

-- Movement/Caliber Master Table for watch movements with compatible parts cross-reference
CREATE TABLE IF NOT EXISTS public.calibers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caliber_number TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  name TEXT,
  movement_type TEXT, -- automatic, manual, quartz
  frequency INTEGER, -- beats per hour (e.g., 28800)
  jewels INTEGER,
  power_reserve_hours INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Caliber to Part cross-reference (which parts are compatible with which caliber)
CREATE TABLE IF NOT EXISTS public.caliber_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caliber_id UUID NOT NULL REFERENCES public.calibers(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  position TEXT, -- e.g., "mainspring", "balance wheel", "crown"
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(caliber_id, part_id)
);

-- Reorder suggestions table for tracking low stock items and auto-PO generation
CREATE TABLE IF NOT EXISTS public.reorder_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  suggested_qty INTEGER NOT NULL DEFAULT 1,
  current_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  suggested_cost NUMERIC(12,4),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, ordered, dismissed
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Label print history for tracking printed labels
CREATE TABLE IF NOT EXISTS public.label_prints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_type TEXT NOT NULL, -- 'part_barcode', 'client_qr', 'bin_label'
  reference_id UUID NOT NULL, -- part_id, client_property_id, or bin_id
  reference_type TEXT NOT NULL, -- 'part', 'client_property', 'bin'
  label_data JSONB, -- stored label content for reprint
  printed_by UUID,
  printed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add caliber reference to parts table
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS caliber_id UUID REFERENCES public.calibers(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_caliber_parts_caliber_id ON public.caliber_parts(caliber_id);
CREATE INDEX IF NOT EXISTS idx_caliber_parts_part_id ON public.caliber_parts(part_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_status ON public.reorder_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_part_id ON public.reorder_suggestions(part_id);
CREATE INDEX IF NOT EXISTS idx_label_prints_reference ON public.label_prints(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_calibers_brand ON public.calibers(brand);
CREATE INDEX IF NOT EXISTS idx_calibers_caliber_number ON public.calibers(caliber_number);

-- Enable RLS
ALTER TABLE public.calibers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caliber_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_prints ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Calibers viewable by authenticated users" 
ON public.calibers FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Calibers manageable by authenticated users" 
ON public.calibers FOR ALL 
USING (public.is_authenticated());

CREATE POLICY "Caliber parts viewable by authenticated users" 
ON public.caliber_parts FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Caliber parts manageable by authenticated users" 
ON public.caliber_parts FOR ALL 
USING (public.is_authenticated());

CREATE POLICY "Reorder suggestions viewable by authenticated users" 
ON public.reorder_suggestions FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Reorder suggestions manageable by authenticated users" 
ON public.reorder_suggestions FOR ALL 
USING (public.is_authenticated());

CREATE POLICY "Label prints viewable by authenticated users" 
ON public.label_prints FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Label prints manageable by authenticated users" 
ON public.label_prints FOR ALL 
USING (public.is_authenticated());

-- Update triggers
CREATE TRIGGER update_calibers_updated_at
  BEFORE UPDATE ON public.calibers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reorder_suggestions_updated_at
  BEFORE UPDATE ON public.reorder_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate reorder suggestions based on stock levels
CREATE OR REPLACE FUNCTION public.generate_reorder_suggestions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suggestion_count INTEGER := 0;
BEGIN
  -- Insert suggestions for parts below reorder point
  INSERT INTO public.reorder_suggestions (part_id, vendor_id, suggested_qty, current_on_hand, reorder_point, suggested_cost, status)
  SELECT 
    p.id,
    vp.vendor_id,
    GREATEST(COALESCE(p.reorder_qty, p.reorder_point, 1), 1) as suggested_qty,
    COALESCE(SUM(ist.qty_on_hand), 0) as current_on_hand,
    COALESCE(p.reorder_point, 0),
    COALESCE(vp.vendor_cost, p.last_cost, p.average_cost) as suggested_cost,
    'pending'
  FROM public.parts p
  LEFT JOIN public.inventory_stock ist ON ist.part_id = p.id
  LEFT JOIN public.vendor_parts vp ON vp.part_id = p.id AND vp.is_preferred = true
  WHERE p.item_type = 'inventory' 
    AND p.is_active = true 
    AND p.reorder_point > 0
    AND p.id NOT IN (
      SELECT rs.part_id FROM public.reorder_suggestions rs WHERE rs.status IN ('pending', 'approved')
    )
  GROUP BY p.id, vp.vendor_id, vp.vendor_cost
  HAVING COALESCE(SUM(ist.qty_on_hand), 0) <= p.reorder_point;
  
  GET DIAGNOSTICS suggestion_count = ROW_COUNT;
  RETURN suggestion_count;
END;
$$;

-- Seed some common watch calibers
INSERT INTO public.calibers (caliber_number, brand, name, movement_type, frequency, jewels, power_reserve_hours, notes) VALUES
('3135', 'Rolex', 'Oyster Perpetual', 'automatic', 28800, 31, 48, 'Most common Rolex caliber'),
('3235', 'Rolex', 'Oyster Perpetual', 'automatic', 28800, 31, 70, 'New generation Rolex caliber'),
('3186', 'Rolex', 'GMT-Master', 'automatic', 28800, 31, 48, 'GMT caliber with jumping hour'),
('4130', 'Rolex', 'Daytona', 'automatic', 28800, 44, 72, 'In-house chronograph'),
('324 S C', 'Patek Philippe', 'Self-winding', 'automatic', 28800, 29, 45, 'Standard Patek automatic'),
('CH 29-535 PS', 'Patek Philippe', 'Chronograph', 'manual', 28800, 33, 65, 'Split-seconds chronograph'),
('8900', 'Omega', 'Master Co-Axial', 'automatic', 25200, 39, 60, 'Anti-magnetic to 15,000 gauss'),
('9300', 'Omega', 'Co-Axial Chronograph', 'automatic', 28800, 54, 60, 'Column-wheel chronograph'),
('79320', 'Tudor', 'MT5813', 'automatic', 28800, 28, 70, 'COSC certified chronograph'),
('F385', 'Cartier', 'Manufacture', 'automatic', 28800, 25, 48, 'Skeleton movement')
ON CONFLICT (caliber_number) DO NOTHING;