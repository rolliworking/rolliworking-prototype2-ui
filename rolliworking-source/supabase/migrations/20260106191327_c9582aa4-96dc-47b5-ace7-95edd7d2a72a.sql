-- Drop the existing check constraint
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;

-- Add updated check constraint with liability_waiver type
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check 
CHECK (type IN ('movement_service_update', 'bracelet_work_update', 'parts_approval', 'inspection_complete', 'job_complete', 'liability_waiver', 'custom'));