-- Add column to track sent email template names
ALTER TABLE public.jobs 
ADD COLUMN sent_email_templates jsonb DEFAULT '[]'::jsonb;