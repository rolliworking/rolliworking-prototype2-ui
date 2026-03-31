
ALTER TABLE public.inspection_approvals
ADD COLUMN polish_answers jsonb DEFAULT '{}'::jsonb,
ADD COLUMN question_answers jsonb DEFAULT '{}'::jsonb;
