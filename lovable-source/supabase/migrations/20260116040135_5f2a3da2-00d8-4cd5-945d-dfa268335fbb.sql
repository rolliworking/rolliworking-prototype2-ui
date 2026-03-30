-- Drop existing overly permissive policies on qbo_tokens
DROP POLICY IF EXISTS "Authenticated users can view tokens" ON public.qbo_tokens;
DROP POLICY IF EXISTS "Authenticated users can insert tokens" ON public.qbo_tokens;
DROP POLICY IF EXISTS "Authenticated users can update tokens" ON public.qbo_tokens;

-- Create admin-only policies for qbo_tokens
CREATE POLICY "Admins can view qbo tokens" 
ON public.qbo_tokens 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert qbo tokens" 
ON public.qbo_tokens 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update qbo tokens" 
ON public.qbo_tokens 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete qbo tokens" 
ON public.qbo_tokens 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::public.app_role));