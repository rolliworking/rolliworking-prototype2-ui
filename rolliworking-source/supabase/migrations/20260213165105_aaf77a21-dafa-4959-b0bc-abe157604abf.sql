
ALTER TABLE public.inspection_questions
ADD COLUMN show_on_client boolean NOT NULL DEFAULT true,
ADD COLUMN required_for_submission boolean NOT NULL DEFAULT false;
