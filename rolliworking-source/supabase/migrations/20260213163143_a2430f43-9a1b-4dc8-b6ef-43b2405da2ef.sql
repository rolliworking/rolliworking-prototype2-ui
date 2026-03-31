
-- Inspection questions (editable labels for Q1, Q2, Q3, S1)
CREATE TABLE public.inspection_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view questions" ON public.inspection_questions FOR SELECT USING (true);
CREATE POLICY "Owner and Manager can manage questions" ON public.inspection_questions FOR ALL USING (can_edit_data(auth.uid())) WITH CHECK (can_edit_data(auth.uid()));

-- Seed default questions
INSERT INTO public.inspection_questions (key, label, description) VALUES
  ('Q1', 'Courtesy Polish', 'No-cost courtesy polish offered to customer'),
  ('Q2', 'Bracelet Polish Scale', 'Band polish scale 0-10, required for bracelet job types'),
  ('Q3', 'Watch Head Polish', 'Polish for the watch head/case'),
  ('S1', 'Retail Polish', 'Retail polish selection in Section E');

-- Inspection rules engine
CREATE TABLE public.inspection_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section text NOT NULL,
  job_types text[] NOT NULL DEFAULT '{}',
  action text NOT NULL DEFAULT 'hide',
  target_question text NOT NULL REFERENCES public.inspection_questions(key),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rules" ON public.inspection_rules FOR SELECT USING (true);
CREATE POLICY "Owner and Manager can manage rules" ON public.inspection_rules FOR ALL USING (can_edit_data(auth.uid())) WITH CHECK (can_edit_data(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_inspection_questions_updated_at BEFORE UPDATE ON public.inspection_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inspection_rules_updated_at BEFORE UPDATE ON public.inspection_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
