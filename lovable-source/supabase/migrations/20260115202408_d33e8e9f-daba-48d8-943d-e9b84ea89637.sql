-- Create package_scan_logs table for daily barcode logging
CREATE TABLE public.package_scan_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_number TEXT NOT NULL,
  tracking_formatted TEXT,
  carrier TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scanned_by UUID REFERENCES auth.users(id),
  matched_customer_id UUID REFERENCES public.customers(id),
  matched_estimate_id UUID REFERENCES public.estimates(id),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.package_scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for package_scan_logs
CREATE POLICY "Authenticated users can view package scan logs"
  ON public.package_scan_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert package scan logs"
  ON public.package_scan_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update package scan logs"
  ON public.package_scan_logs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_package_scan_logs_tracking ON public.package_scan_logs(tracking_number);
CREATE INDEX idx_package_scan_logs_scanned_at ON public.package_scan_logs(scanned_at DESC);
CREATE INDEX idx_package_scan_logs_matched_customer ON public.package_scan_logs(matched_customer_id);
CREATE INDEX idx_package_scan_logs_email_sent ON public.package_scan_logs(email_sent) WHERE email_sent = false;