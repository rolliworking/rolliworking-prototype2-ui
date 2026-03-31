-- Hide Courtesy Polish (Q1) for small_job type
INSERT INTO public.inspection_rules (target_question, action, job_types, sort_order, section, description, is_active)
VALUES ('Q1', 'hide', ARRAY['small_job'], 4, 'general', 'Hide Courtesy Polish for small jobs', true);