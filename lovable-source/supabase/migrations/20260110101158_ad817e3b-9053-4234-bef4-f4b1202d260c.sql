-- Add new fields to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS middle_name text,
ADD COLUMN IF NOT EXISTS suffix text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS internal_notes text,
ADD COLUMN IF NOT EXISTS email_normalized text,
ADD COLUMN IF NOT EXISTS phone_normalized text,
ADD COLUMN IF NOT EXISTS qbo_customer_id text;

-- Create indexes for duplicate detection and search
CREATE INDEX IF NOT EXISTS idx_customers_email_normalized ON public.customers(email_normalized);
CREATE INDEX IF NOT EXISTS idx_customers_phone_normalized ON public.customers(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_customers_display_name ON public.customers(display_name);
CREATE INDEX IF NOT EXISTS idx_customers_qbo_customer_id ON public.customers(qbo_customer_id);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_type text NOT NULL CHECK (address_type IN ('billing', 'shipping')),
  street1 text,
  street2 text,
  city text,
  state text,
  zip text,
  country text DEFAULT 'US',
  is_same_as_billing boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, address_type)
);

-- Enable RLS on customer_addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_addresses
CREATE POLICY "Authenticated users can view customer_addresses"
ON public.customer_addresses FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can create customer_addresses"
ON public.customer_addresses FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update customer_addresses"
ON public.customer_addresses FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Admins can delete customer_addresses"
ON public.customer_addresses FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create customer_communication_permissions table
CREATE TABLE IF NOT EXISTS public.customer_communication_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
  consent_email text,
  consent_recorded boolean DEFAULT false,
  consent_recorded_at timestamp with time zone,
  consent_recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on customer_communication_permissions
ALTER TABLE public.customer_communication_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_communication_permissions
CREATE POLICY "Authenticated users can view customer_communication_permissions"
ON public.customer_communication_permissions FOR SELECT
USING (is_authenticated());

CREATE POLICY "Authenticated users can create customer_communication_permissions"
ON public.customer_communication_permissions FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Authenticated users can update customer_communication_permissions"
ON public.customer_communication_permissions FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Admins can delete customer_communication_permissions"
ON public.customer_communication_permissions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to normalize email
CREATE OR REPLACE FUNCTION normalize_email(email text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(TRIM(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Function to normalize phone (remove non-digits)
CREATE OR REPLACE FUNCTION normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Trigger to auto-update normalized fields and display_name
CREATE OR REPLACE FUNCTION update_customer_normalized_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize email
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    NEW.email_normalized := normalize_email(NEW.email);
  ELSE
    NEW.email_normalized := NULL;
  END IF;
  
  -- Normalize phone
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    NEW.phone_normalized := normalize_phone(NEW.phone);
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  
  -- Auto-generate display_name if not set
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
    IF NEW.display_name = '' AND NEW.company_name IS NOT NULL THEN
      NEW.display_name := NEW.company_name;
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_customer_normalized ON public.customers;
CREATE TRIGGER trigger_update_customer_normalized
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION update_customer_normalized_fields();

-- Trigger to update updated_at on customer_addresses
CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trigger_update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_customer_addresses_updated_at();

-- Trigger to update updated_at on customer_communication_permissions
CREATE OR REPLACE FUNCTION update_customer_communication_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_customer_communication_permissions_updated_at ON public.customer_communication_permissions;
CREATE TRIGGER trigger_update_customer_communication_permissions_updated_at
BEFORE UPDATE ON public.customer_communication_permissions
FOR EACH ROW
EXECUTE FUNCTION update_customer_communication_permissions_updated_at();