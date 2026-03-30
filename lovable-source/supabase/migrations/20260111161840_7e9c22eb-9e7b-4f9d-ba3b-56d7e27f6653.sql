-- Create estimate templates table
CREATE TABLE public.estimate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create estimate template line items table
CREATE TABLE public.estimate_template_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.estimate_templates(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id),
  service_subcategory_id UUID REFERENCES public.service_subcategories(id),
  line_type TEXT NOT NULL DEFAULT 'service',
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  taxable BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estimate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_template_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for estimate_templates (authenticated users can read, staff can manage)
CREATE POLICY "Authenticated users can view templates" 
ON public.estimate_templates 
FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can create templates" 
ON public.estimate_templates 
FOR INSERT 
WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update templates" 
ON public.estimate_templates 
FOR UPDATE 
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can delete templates" 
ON public.estimate_templates 
FOR DELETE 
USING (public.is_authenticated());

-- RLS policies for estimate_template_lines
CREATE POLICY "Authenticated users can view template lines" 
ON public.estimate_template_lines 
FOR SELECT 
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can create template lines" 
ON public.estimate_template_lines 
FOR INSERT 
WITH CHECK (public.is_authenticated());

CREATE POLICY "Authenticated users can update template lines" 
ON public.estimate_template_lines 
FOR UPDATE 
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can delete template lines" 
ON public.estimate_template_lines 
FOR DELETE 
USING (public.is_authenticated());

-- Trigger for updated_at
CREATE TRIGGER update_estimate_templates_updated_at
BEFORE UPDATE ON public.estimate_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();