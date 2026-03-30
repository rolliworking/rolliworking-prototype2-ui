-- Add is_na column to intake_leads for leads that should not count toward response time metrics
ALTER TABLE public.intake_leads ADD COLUMN IF NOT EXISTS is_na boolean DEFAULT false;