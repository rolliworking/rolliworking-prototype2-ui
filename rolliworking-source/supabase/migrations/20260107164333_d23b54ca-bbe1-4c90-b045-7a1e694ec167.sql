-- Create permissions table to define all available permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions (read-only for authenticated users)
CREATE POLICY "Authenticated users can view permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for role_permissions
CREATE POLICY "Authenticated users can view role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Owners can manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));

-- Insert default permissions
INSERT INTO public.permissions (key, name, description, category) VALUES
  -- Jobs
  ('jobs.view', 'View Jobs', 'View all jobs in work queue', 'Jobs'),
  ('jobs.create', 'Create Jobs', 'Create new jobs', 'Jobs'),
  ('jobs.edit', 'Edit Jobs', 'Edit existing jobs', 'Jobs'),
  ('jobs.delete', 'Delete Jobs', 'Delete jobs', 'Jobs'),
  ('jobs.change_status', 'Change Job Status', 'Update job status in workflow', 'Jobs'),
  -- Parts
  ('parts.view', 'View Parts Requests', 'View parts requests', 'Parts'),
  ('parts.create', 'Create Parts Requests', 'Add new parts requests', 'Parts'),
  ('parts.set_price', 'Set Part Prices', 'Set prices on parts requests', 'Parts'),
  ('parts.approve', 'Approve Parts', 'Approve or decline parts requests', 'Parts'),
  -- Inspections
  ('inspections.view', 'View Inspections', 'View all inspections', 'Inspections'),
  ('inspections.create', 'Create Inspections', 'Create new inspections', 'Inspections'),
  ('inspections.edit', 'Edit Inspections', 'Edit existing inspections', 'Inspections'),
  -- Customers
  ('customers.view', 'View Customers', 'View customer list', 'Customers'),
  ('customers.create', 'Create Customers', 'Add new customers', 'Customers'),
  ('customers.edit', 'Edit Customers', 'Edit customer details', 'Customers'),
  -- Waivers
  ('waivers.view', 'View Waivers', 'View liability waivers', 'Waivers'),
  ('waivers.create', 'Create Waivers', 'Create new waivers', 'Waivers'),
  ('waivers.approve', 'Approve Waivers', 'Manually approve waivers', 'Waivers'),
  -- Users (admin only)
  ('users.view', 'View Users', 'View user list', 'Users'),
  ('users.manage', 'Manage Users', 'Add, edit, delete users', 'Users'),
  ('users.permissions', 'Manage Permissions', 'Configure role permissions', 'Users')
ON CONFLICT (key) DO NOTHING;

-- Insert default role permissions (Owner gets all, Manager gets most, Staff gets view-only)
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'owner'::app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'manager'::app_role, key FROM public.permissions 
WHERE key NOT IN ('users.view', 'users.manage', 'users.permissions')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'staff'::app_role, key FROM public.permissions 
WHERE key LIKE '%.view'
ON CONFLICT DO NOTHING;

-- Create a function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _permission_key
  )
$$;