-- Drop existing overly permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.profiles;

-- Create new restrictive SELECT policy: users see own profile OR admins see all
CREATE POLICY "Users can view own profile or admins view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);