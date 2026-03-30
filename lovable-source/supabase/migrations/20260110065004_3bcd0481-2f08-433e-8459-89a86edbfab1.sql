-- Drop existing app_role type and recreate with new roles
-- First drop dependent objects
DROP TRIGGER IF EXISTS set_owner_admin ON auth.users;
DROP FUNCTION IF EXISTS public.set_admin_for_owner();

-- Update the role enum to include manager and office
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office';

-- Create job_activity_log table for audit trail
CREATE TABLE public.job_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- Created, Updated, StatusChanged, TestAdded, TestEdited, PDFGenerated
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_job_activity_log_job_id ON public.job_activity_log(job_id);
CREATE INDEX idx_job_activity_log_created_at ON public.job_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.job_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_activity_log
CREATE POLICY "Authenticated users can view activity logs" ON public.job_activity_log
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create activity logs" ON public.job_activity_log
  FOR INSERT WITH CHECK (public.is_authenticated());

-- Create settings table (single row)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'Rolliworks',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  mask_serial_on_print BOOLEAN DEFAULT true,
  serial_mask_rule TEXT DEFAULT 'show_last_4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings, all authenticated can view
CREATE POLICY "Authenticated users can view settings" ON public.settings
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings row
INSERT INTO public.settings (company_name, address, phone, email, website)
VALUES ('Rolliworks', '123 Watch Lane', '555-0100', 'info@rolliworks.com', 'https://rolliworks.com');

-- Update trigger for settings
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate the admin trigger for mike@rolliworks.com
CREATE OR REPLACE FUNCTION public.set_admin_for_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'mike@rolliworks.com' THEN
    UPDATE public.user_roles 
    SET role = 'admin' 
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_admin_for_owner();

-- Function to get next job ID
CREATE OR REPLACE FUNCTION public.get_next_job_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  max_num INTEGER;
  next_id TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_id FROM 2) AS INTEGER)), 0)
  INTO max_num
  FROM public.jobs
  WHERE job_id ~ '^E\d+$';
  
  next_id := 'E' || (max_num + 1)::TEXT;
  RETURN next_id;
END;
$$;

-- Function to check if job ID exists
CREATE OR REPLACE FUNCTION public.job_id_exists(p_job_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.jobs WHERE job_id = p_job_id)
$$;

-- Add has_any_role function for checking multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Update jobs RLS: Only admins can delete
DROP POLICY IF EXISTS "Admins can delete jobs" ON public.jobs;
CREATE POLICY "Admins can delete jobs" ON public.jobs
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Insert default message template if not exists
INSERT INTO public.message_templates (name, subject, body, category)
VALUES (
  'Awaiting Inspection Reply',
  'Inspection Notes – Response Needed to Enter Work Queue',
  'We sent your inspection notes and need your response to add the job to our work queue. Because we schedule bench time, the target due date may need to be adjusted until we receive your reply.',
  'customer_communication'
) ON CONFLICT DO NOTHING;