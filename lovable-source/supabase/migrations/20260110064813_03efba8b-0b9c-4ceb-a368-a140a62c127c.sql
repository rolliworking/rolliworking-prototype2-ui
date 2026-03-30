-- Pre-configure admin role for the owner account
-- This will update the role when the user signs up with this email
CREATE OR REPLACE FUNCTION public.set_admin_for_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the new user is the owner, set them as admin
  IF NEW.email = 'mike@rolliworks.com' THEN
    UPDATE public.user_roles 
    SET role = 'admin' 
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-promote owner after user creation
CREATE TRIGGER set_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_admin_for_owner();