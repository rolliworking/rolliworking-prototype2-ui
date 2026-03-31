
-- Create wiki_articles table for internal documentation
CREATE TABLE public.wiki_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read wiki
CREATE POLICY "Authenticated users can view wiki articles"
  ON public.wiki_articles FOR SELECT
  USING (true);

-- Only owners/managers can create
CREATE POLICY "Owner and Manager can create wiki articles"
  ON public.wiki_articles FOR INSERT
  WITH CHECK (can_edit_data(auth.uid()));

-- Only owners/managers can update
CREATE POLICY "Owner and Manager can update wiki articles"
  ON public.wiki_articles FOR UPDATE
  USING (can_edit_data(auth.uid()));

-- Only owners/managers can delete
CREATE POLICY "Owner and Manager can delete wiki articles"
  ON public.wiki_articles FOR DELETE
  USING (can_edit_data(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_wiki_articles_updated_at
  BEFORE UPDATE ON public.wiki_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with initial polish rules documentation
INSERT INTO public.wiki_articles (title, content, category, sort_order) VALUES
('Polish Question Rules', E'# Polish Question Rules\n\n## Section Letters\n- **A** = Dial\n- **B** = Hands\n- **C** = Bezel\n- **D** = Crown\n- **E** = Case\n- **F** = Crystal\n- **G** = Bracelet\n\n## Questions\n1. **Courtesy Polish (YES/NO)** — Free, included with movement service work. NO-COST light courtesy polish of case and bracelet.\n2. **Bracelet Polish Scale (0-10)** — 0-7 is free, 8-10 is +$250 retail polish.\n3. **Watch Head Polish (YES/NO)** — Same as courtesy polish but specifically for complete watch with movement service.\n\n## Rules\n- If **E (Case)** has job type `case_work` or `case_restoration` → **HIDE** Q1 (courtesy polish)\n- If **E (Case)** has retail polish selected → **HIDE** Q1 and Q3\n- If **G (Bracelet)** has band polish toggle ON + movement service → **SHOW** Q2 (bracelet scale) + Q3 (watch head polish)\n- If **G (Bracelet)** has band polish toggle ON + case work → **SHOW** Q2 only\n- If **G (Bracelet)** has band polish toggle ON + bracelet only → **SHOW** Q2 only\n- If band polish toggle OFF, no case work, no retail polish → **SHOW** Q1 (courtesy polish YES/NO)\n\n## Pricing\n- Hourly rate: $98/hr (bracelet repair calculations)\n- Retail polish threshold: 8-10 on scale = +$250', 'inspection_rules', 1),

('Job Types Reference', E'# Job Types\n\n## Movement Types (target dates)\n- `modern_movement` — 4 weeks\n- `antique_movement` — 27 weeks\n- `vintage_movement` — 12 weeks\n- `chrono` — 8 weeks\n- LV2 variants add +4 weeks to base\n\n## Other Types\n- `case_work` / `case_restoration` — 4 weeks\n- `stretch_repair` — 4 weeks (bracelet only / band only)\n- `bracelet_work` / `bracelet_repair` — bracelet jobs\n- `gold_bracelet` — gold bracelet work\n- `warranty` — 4 weeks\n- `small_job` / `partial_job` — misc\n- `general_repair` / `other` — default', 'inspection_rules', 2),

('Inspection Section Notes', E'# Inspection Sections\n\nEach section uses a numbered badge system matching the printed scantron sheet.\n\n## Sections\n- **A - Dial**: Conditions + waiver support\n- **B - Hands**: Conditions + waiver support\n- **C - Bezel**: Standard conditions\n- **D - Crown**: Standard conditions (Note #9: case tube $55)\n- **E - Case**: Retail polish checkbox, case restoration price, welding $140/hr\n- **F - Crystal**: Standard conditions\n- **G - Bracelet**: Conditions + bracelet repair options\n\n## Bracelet Repair Options\n1. Shorter Links (qty × price)\n2. Steel Side pieces (hours @ $98/hr)\n3. Steel Center pieces (hours @ $98/hr)\n4. Gold Center pieces (qty × price)\n5. Invert pieces / foil thin (qty × price)\n6. Band Polish (0-10 scale toggle)', 'inspection_rules', 3),

('Email Template Types', E'# Email Template Categories\n\n- `waiting_approval` — Orange theme, sent when awaiting client response\n- `inspection_notes` — Teal theme, inspection findings\n- `inspection_approval` — Used for mailto links with approval URL\n- `parts_approval` — Parts pricing approval\n- `liability_waiver` — Waiver notifications\n- `movement_service_update` — Red status downgrade theme\n- `custom` — User-created templates', 'email', 4);
