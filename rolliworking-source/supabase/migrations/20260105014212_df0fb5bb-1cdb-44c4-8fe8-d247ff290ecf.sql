-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_type_check CHECK (type IN (
    'movement_service_update',
    'bracelet_work_update', 
    'parts_approval',
    'inspection_complete',
    'job_complete',
    'custom'
  ))
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_templates
CREATE POLICY "Authenticated users can view email templates"
ON public.email_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create email templates"
ON public.email_templates FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates"
ON public.email_templates FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete email templates"
ON public.email_templates FOR DELETE TO authenticated
USING (true);

-- Update jobs table with new columns
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_tasks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS repair_tasks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_movement_service BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parts_approval_needed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parts_details TEXT,
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add trigger for updated_at on email_templates
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update jobs status constraint with new 'inspection' status
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'intake',
  'inspection',
  'waiting_approval',
  'in_queue',
  'in_progress',
  'in_testing',
  'completed'
));