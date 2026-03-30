-- Add awaiting_reply column to intake_leads
ALTER TABLE public.intake_leads 
ADD COLUMN awaiting_reply boolean DEFAULT false;