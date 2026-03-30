-- Create table for synced QBO invoices
CREATE TABLE public.qbo_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qbo_invoice_id TEXT NOT NULL UNIQUE,
  doc_number TEXT,
  customer_name TEXT,
  customer_qbo_id TEXT,
  customer_id UUID REFERENCES public.customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'open',
  line_items JSONB,
  memo TEXT,
  is_editable BOOLEAN NOT NULL DEFAULT false,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qbo_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view invoices"
  ON public.qbo_invoices FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert invoices"
  ON public.qbo_invoices FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update editable invoices"
  ON public.qbo_invoices FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin') AND is_editable = true);

CREATE POLICY "Admins can delete invoices"
  ON public.qbo_invoices FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_qbo_invoices_updated_at
  BEFORE UPDATE ON public.qbo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_qbo_invoices_invoice_date ON public.qbo_invoices(invoice_date DESC);
CREATE INDEX idx_qbo_invoices_customer_qbo_id ON public.qbo_invoices(customer_qbo_id);
CREATE INDEX idx_qbo_invoices_status ON public.qbo_invoices(status);