-- Create a function to update user role based on invitation
CREATE OR REPLACE FUNCTION public.handle_invitation_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Check if there's an accepted invitation for this user's email
  SELECT id, role INTO invite_record
  FROM public.invitations
  WHERE email = NEW.email
    AND accepted_at IS NOT NULL
    AND accepted_at >= (NOW() - INTERVAL '1 hour')
  ORDER BY accepted_at DESC
  LIMIT 1;

  -- If found, update the user's role to match the invitation
  IF invite_record.id IS NOT NULL THEN
    UPDATE public.user_roles
    SET role = invite_record.role
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run after user profile is created
CREATE TRIGGER on_profile_created_check_invitation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invitation_signup();