-- Create table to store custom role permissions overrides
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can read permissions
CREATE POLICY "Authenticated users can read role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Only admins can update permissions
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- Create trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions for manager and team roles
INSERT INTO public.role_permissions (role, permission_key, enabled) VALUES
  -- Manager permissions
  ('manager', 'canDeleteJobs', false),
  ('manager', 'canManageUsers', false),
  ('manager', 'canManageSettings', false),
  ('manager', 'canAccessSetup', false),
  ('manager', 'canExportCSV', true),
  ('manager', 'canEditTestsAnytime', true),
  ('manager', 'canEditTestsWithin24Hours', true),
  ('manager', 'canAccessIntake', true),
  -- Team permissions
  ('team', 'canDeleteJobs', false),
  ('team', 'canManageUsers', false),
  ('team', 'canManageSettings', false),
  ('team', 'canAccessSetup', false),
  ('team', 'canExportCSV', false),
  ('team', 'canEditTestsAnytime', false),
  ('team', 'canEditTestsWithin24Hours', true),
  ('team', 'canAccessIntake', true);