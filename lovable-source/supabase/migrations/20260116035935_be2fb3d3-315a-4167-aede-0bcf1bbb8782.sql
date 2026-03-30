-- Remove the overly permissive public SELECT policy on invitations
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitations;