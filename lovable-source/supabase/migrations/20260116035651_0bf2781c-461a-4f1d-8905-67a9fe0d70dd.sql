-- Drop existing SELECT policy on customers table
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;

-- Create new role-based SELECT policy for customers
CREATE POLICY "Elevated roles can view customers" 
ON public.customers 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'manager'::public.app_role) OR
  public.has_role(auth.uid(), 'office'::public.app_role)
);