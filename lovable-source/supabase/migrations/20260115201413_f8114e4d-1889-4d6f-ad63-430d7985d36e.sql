-- Create shipping_labels table to store uploaded label tracking info
CREATE TABLE public.shipping_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES public.estimates(id),
  customer_id UUID REFERENCES public.customers(id),
  tracking_number TEXT NOT NULL,
  tracking_number_formatted TEXT, -- FedEx display format: 8879 0105 0201 2066
  carrier TEXT DEFAULT 'FedEx',
  insurance_amount NUMERIC DEFAULT 0,
  ship_date DATE,
  status TEXT DEFAULT 'pending', -- pending, sent, delivered
  label_file_path TEXT, -- Storage path for the PDF
  request_line_item_id UUID, -- Link to the $0 line item request
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view shipping labels"
ON public.shipping_labels FOR SELECT
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can create shipping labels"
ON public.shipping_labels FOR INSERT
WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update shipping labels"
ON public.shipping_labels FOR UPDATE
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can delete shipping labels"
ON public.shipping_labels FOR DELETE
USING (public.is_authenticated());

-- Add trigger for updated_at
CREATE TRIGGER update_shipping_labels_updated_at
BEFORE UPDATE ON public.shipping_labels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_shipping_labels_tracking ON public.shipping_labels(tracking_number);
CREATE INDEX idx_shipping_labels_estimate ON public.shipping_labels(estimate_id);
CREATE INDEX idx_shipping_labels_customer ON public.shipping_labels(customer_id);