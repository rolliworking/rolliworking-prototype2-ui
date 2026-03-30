-- Add parent_customer_id to customers table for company/client hierarchy
ALTER TABLE public.customers 
ADD COLUMN parent_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_customers_parent_customer_id ON public.customers(parent_customer_id);

-- Add is_organization flag to distinguish companies from individuals
ALTER TABLE public.customers 
ADD COLUMN is_organization boolean DEFAULT false;