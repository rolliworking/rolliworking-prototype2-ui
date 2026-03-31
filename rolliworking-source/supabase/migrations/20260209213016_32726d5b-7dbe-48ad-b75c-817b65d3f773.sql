
-- Drop existing check constraint and add updated one with status_downgrade
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check CHECK (type IN ('movement_service_update', 'bracelet_work_update', 'parts_approval', 'inspection_complete', 'inspection_notes', 'waiting_approval', 'job_complete', 'liability_waiver', 'custom', 'status_downgrade'));

-- Seed default template
INSERT INTO public.email_templates (name, type, subject, body, is_active)
VALUES (
  'Testing Downgrade - Additional Work',
  'status_downgrade',
  'Update on Your {{brand}} {{model}} – Additional Work Required',
  E'Dear {{client_name}},\n\nThank you for your patience as we continue working on your {{brand}} {{model}} (Ref: {{Ref_number}}).\n\nDuring our final testing phase, our watchmaker identified an area that requires additional attention to ensure your timepiece meets our quality standards. We have moved the watch back into active service to address this.\n\nPlease rest assured this is a routine part of our commitment to excellence — we will not release your watch until we are fully satisfied with its performance.\n\nWe will keep you updated on the progress and let you know as soon as your watch is ready.\n\nIf you have any questions in the meantime, please don''t hesitate to reach out.\n\nWarm regards,\nThe Rolliworks Team',
  true
);
