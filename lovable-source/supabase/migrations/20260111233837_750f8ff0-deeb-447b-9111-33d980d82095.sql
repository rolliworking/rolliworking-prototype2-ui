-- Create inspection_requests table to track inspections after intake
CREATE TABLE public.inspection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.inspection_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view inspection requests"
ON public.inspection_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create inspection requests"
ON public.inspection_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update inspection requests"
ON public.inspection_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete inspection requests"
ON public.inspection_requests
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create indexes for faster lookups
CREATE INDEX idx_inspection_requests_estimate_id ON public.inspection_requests(estimate_id);
CREATE INDEX idx_inspection_requests_customer_id ON public.inspection_requests(customer_id);
CREATE INDEX idx_inspection_requests_status ON public.inspection_requests(status);