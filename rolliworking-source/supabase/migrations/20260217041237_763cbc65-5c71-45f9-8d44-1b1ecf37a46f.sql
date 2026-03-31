
-- Service code mappings (replaces hardcoded SERVICE_CODE_MAP)
CREATE TABLE public.service_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  weeks INTEGER NOT NULL DEFAULT 4,
  label TEXT NOT NULL,
  is_bracelet BOOLEAN NOT NULL DEFAULT false,
  is_movement_service BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed by edge functions via service role, and frontend)
CREATE POLICY "Anyone can view service codes"
  ON public.service_codes FOR SELECT
  USING (true);

CREATE POLICY "Owner and Manager can manage service codes"
  ON public.service_codes FOR ALL
  USING (can_edit_data(auth.uid()))
  WITH CHECK (can_edit_data(auth.uid()));

-- Seed with current hardcoded values
INSERT INTO public.service_codes (code, job_type, weeks, label, is_bracelet, is_movement_service, sort_order) VALUES
  ('M',  'modern_movement',  4,  'Modern Movement',          false, true,  1),
  ('M2', 'modern_lv2',       4,  'Modern LV2',               false, true,  2),
  ('V',  'vintage_movement', 12, 'Vintage Movement',         false, true,  3),
  ('V2', 'vintage_lv2',      12, 'Vintage LV2',              false, true,  4),
  ('A',  'antique_movement', 27, 'Antique Movement',         false, true,  5),
  ('A2', 'antique_lv2',      27, 'Antique LV2',              false, true,  6),
  ('C',  'chrono',           8,  'Chronograph',              false, true,  7),
  ('C2', 'chrono_lv2',       12, 'Chronograph LV2',          false, true,  8),
  ('W',  'modern_movement',  4,  'Generic Movement Service', false, true,  9),
  ('WR', 'warranty',         4,  'Warranty',                 false, true,  10),
  ('CW', 'case_work',        4,  'Case Work',                false, false, 11),
  ('P',  'case_work',        4,  'Polish / Case Work',       false, false, 12),
  ('B',  'bracelet_work',    3,  'Bracelet',                 true,  false, 13),
  ('BR', 'bracelet_repair',  3,  'Bracelet Repair',          true,  false, 14),
  ('GB', 'gold_bracelet',    6,  'Gold Bracelet',            true,  false, 15),
  ('SR', 'stretch_repair',   3,  'Stretch Repair',           true,  false, 16);
