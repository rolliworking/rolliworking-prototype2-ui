-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create job status enum
CREATE TYPE public.job_status AS ENUM (
  'intake',
  'in_review', 
  'awaiting_customer_approval',
  'approved',
  'in_service',
  'testing',
  'ready_to_ship',
  'closed'
);

-- Create priority enum
CREATE TYPE public.priority_level AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create watches table (stores watch info, serial numbers are searchable)
CREATE TABLE public.watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  reference_number TEXT,
  serial_number TEXT,
  movement_type TEXT,
  case_material TEXT,
  band_material TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL UNIQUE,
  estimate_number TEXT,
  quickbooks_invoice_id TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  watch_id UUID REFERENCES public.watches(id) ON DELETE CASCADE NOT NULL,
  status job_status NOT NULL DEFAULT 'intake',
  priority priority_level NOT NULL DEFAULT 'normal',
  due_date DATE,
  intake_notes TEXT,
  condition_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create job_status_history table
CREATE TABLE public.job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  from_status job_status,
  to_status job_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create timing_tests table
CREATE TABLE public.timing_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  test_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  machine TEXT,
  lift_angle DECIMAL(5,2),
  rate DECIMAL(8,2),
  amplitude DECIMAL(6,2),
  beat_error DECIMAL(6,4),
  position_dial_up_rate DECIMAL(8,2),
  position_dial_up_amplitude DECIMAL(6,2),
  position_dial_down_rate DECIMAL(8,2),
  position_dial_down_amplitude DECIMAL(6,2),
  position_crown_up_rate DECIMAL(8,2),
  position_crown_up_amplitude DECIMAL(6,2),
  position_crown_down_rate DECIMAL(8,2),
  position_crown_down_amplitude DECIMAL(6,2),
  position_crown_left_rate DECIMAL(8,2),
  position_crown_left_amplitude DECIMAL(6,2),
  position_crown_right_rate DECIMAL(8,2),
  position_crown_right_amplitude DECIMAL(6,2),
  notes TEXT,
  tested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pressure_tests table
CREATE TABLE public.pressure_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  test_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  tester TEXT,
  method TEXT,
  target_bar DECIMAL(5,2),
  result_passed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  tested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create line_items table
CREATE TABLE public.line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  internal_cost DECIMAL(10,2),
  taxable BOOLEAN NOT NULL DEFAULT true,
  category TEXT,
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  timing_test_id UUID REFERENCES public.timing_tests(id) ON DELETE CASCADE,
  pressure_test_id UUID REFERENCES public.pressure_tests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  attachment_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create quickbooks_sync_log table
CREATE TABLE public.quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  synced_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create message_templates table
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for search
CREATE INDEX idx_watches_serial ON public.watches(serial_number);
CREATE INDEX idx_watches_brand ON public.watches(brand);
CREATE INDEX idx_watches_reference ON public.watches(reference_number);
CREATE INDEX idx_jobs_job_id ON public.jobs(job_id);
CREATE INDEX idx_jobs_estimate_number ON public.jobs(estimate_number);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_due_date ON public.jobs(due_date);
CREATE INDEX idx_customers_name ON public.customers(last_name, first_name);
CREATE INDEX idx_customers_email ON public.customers(email);

-- Create has_role function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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
      AND role = _role
  )
$$;

-- Create is_authenticated function
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_watches_updated_at BEFORE UPDATE ON public.watches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for job status history
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_status_history (job_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_job_status AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_job_status_change();

-- Create trigger for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default to staff role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate job_id function
CREATE OR REPLACE FUNCTION public.generate_job_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_id TEXT;
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_id FROM 3) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.jobs
  WHERE job_id LIKE year_prefix || '%';
  
  new_id := year_prefix || LPAD(next_num::TEXT, 5, '0');
  RETURN new_id;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timing_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pressure_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customers (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create customers" ON public.customers
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update customers" ON public.customers
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Admins can delete customers" ON public.customers
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for watches
CREATE POLICY "Authenticated users can view watches" ON public.watches
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create watches" ON public.watches
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update watches" ON public.watches
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Admins can delete watches" ON public.watches
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for jobs
CREATE POLICY "Authenticated users can view jobs" ON public.jobs
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update jobs" ON public.jobs
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Admins can delete jobs" ON public.jobs
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for job_status_history
CREATE POLICY "Authenticated users can view status history" ON public.job_status_history
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "System can insert status history" ON public.job_status_history
  FOR INSERT WITH CHECK (public.is_authenticated());

-- RLS Policies for timing_tests
CREATE POLICY "Authenticated users can view timing tests" ON public.timing_tests
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create timing tests" ON public.timing_tests
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update timing tests" ON public.timing_tests
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Admins can delete timing tests" ON public.timing_tests
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pressure_tests
CREATE POLICY "Authenticated users can view pressure tests" ON public.pressure_tests
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create pressure tests" ON public.pressure_tests
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update pressure tests" ON public.pressure_tests
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Admins can delete pressure tests" ON public.pressure_tests
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for line_items
CREATE POLICY "Authenticated users can view line items" ON public.line_items
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create line items" ON public.line_items
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update line items" ON public.line_items
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete line items" ON public.line_items
  FOR DELETE USING (public.is_authenticated());

-- RLS Policies for attachments
CREATE POLICY "Authenticated users can view attachments" ON public.attachments
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create attachments" ON public.attachments
  FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update attachments" ON public.attachments
  FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete attachments" ON public.attachments
  FOR DELETE USING (public.is_authenticated());

-- RLS Policies for quickbooks_sync_log
CREATE POLICY "Authenticated users can view sync logs" ON public.quickbooks_sync_log
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create sync logs" ON public.quickbooks_sync_log
  FOR INSERT WITH CHECK (public.is_authenticated());

-- RLS Policies for message_templates
CREATE POLICY "Authenticated users can view message templates" ON public.message_templates
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Admins can manage message templates" ON public.message_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

-- Storage policies for attachments bucket
CREATE POLICY "Authenticated users can view attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update their attachments" ON storage.objects
  FOR UPDATE USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'attachments' AND public.has_role(auth.uid(), 'admin'));

-- Insert default message template
INSERT INTO public.message_templates (name, subject, body, category)
VALUES (
  'Awaiting Approval',
  'Your Watch Service Estimate - Awaiting Your Response',
  'Dear {{customer_name}},

Thank you for entrusting your {{watch_brand}} {{watch_model}} to Rolliworks.

We have completed our initial inspection and prepared an estimate for the required service. Your watch is currently in our queue awaiting your approval to proceed.

Please note: Your position in our work queue and estimated due date may adjust based on when we receive your approval.

To review and approve your estimate, please contact us at your earliest convenience.

Best regards,
The Rolliworks Team',
  'customer_communication'
);