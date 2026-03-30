-- Create table for QBO account mappings
CREATE TABLE public.qbo_account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mapping_key TEXT NOT NULL UNIQUE,
  mapping_label TEXT NOT NULL,
  qbo_account_id TEXT,
  qbo_account_name TEXT,
  qbo_account_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qbo_account_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write mappings
CREATE POLICY "Authenticated users can view account mappings"
  ON public.qbo_account_mappings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update account mappings"
  ON public.qbo_account_mappings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert account mappings"
  ON public.qbo_account_mappings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_qbo_account_mappings_updated_at
  BEFORE UPDATE ON public.qbo_account_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default mapping rows
INSERT INTO public.qbo_account_mappings (mapping_key, mapping_label) VALUES
  ('inventory_asset', 'Inventory Asset'),
  ('cogs', 'Cost of Goods Sold'),
  ('accounts_receivable', 'Accounts Receivable'),
  ('accounts_payable', 'Accounts Payable'),
  ('sales_retail', 'Sales Retail'),
  ('shipping_accrual', 'Shipping Accrual'),
  ('grni_holding', 'Holding (GRNI)'),
  ('undeposited_funds', 'Undeposited Funds');