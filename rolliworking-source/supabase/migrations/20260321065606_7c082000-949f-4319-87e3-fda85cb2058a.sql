ALTER TABLE public.email_templates DROP CONSTRAINT email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check CHECK (type = ANY (ARRAY[
  'custom'::text,
  'waiting_approval'::text,
  'inspection_notes'::text,
  'parts_approval'::text,
  'inspection_approval'::text,
  'liability_waiver'::text,
  'movement_service_update'::text,
  'bracelet_work_update'::text,
  'inspection_complete'::text,
  'job_complete'::text,
  'status_downgrade'::text,
  'bracelet_reply_confirmation'::text,
  'follow_up'::text
]));