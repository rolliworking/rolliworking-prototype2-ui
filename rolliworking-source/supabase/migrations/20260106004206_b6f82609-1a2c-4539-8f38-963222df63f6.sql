-- Drop dependent policies first
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Drop the role_new column we created in failed migration
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS role_new;

-- Drop the new enum type if it exists
DROP TYPE IF EXISTS public.app_role_new;

-- Now add new column with text type temporarily
ALTER TABLE public.user_roles ADD COLUMN role_text text;

-- Migrate existing data: admin -> owner, user -> staff  
UPDATE public.user_roles SET role_text = 'owner' WHERE role::text = 'admin';
UPDATE public.user_roles SET role_text = 'staff' WHERE role::text = 'user';
UPDATE public.user_roles SET role_text = 'staff' WHERE role_text IS NULL;

-- Make the new column not null
ALTER TABLE public.user_roles ALTER COLUMN role_text SET NOT NULL;

-- Drop old column
ALTER TABLE public.user_roles DROP COLUMN role;

-- Drop old enum
DROP TYPE public.app_role;

-- Create new enum with owner, manager, staff
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

-- Add role column back with new type
ALTER TABLE public.user_roles ADD COLUMN role public.app_role NOT NULL DEFAULT 'staff';

-- Copy data from text column
UPDATE public.user_roles SET role = role_text::app_role;

-- Drop the temp text column
ALTER TABLE public.user_roles DROP COLUMN role_text;

-- Recreate has_role function with new type
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create helper function to check if user can manage users (only owner)
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'owner'
  )
$$;

-- Create helper function to check if user can edit data (owner or manager)
CREATE OR REPLACE FUNCTION public.can_edit_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'manager')
  )
$$;

-- Recreate RLS policies for user_roles with new roles
CREATE POLICY "Owners can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'owner') OR user_id = auth.uid());

CREATE POLICY "Owners can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'owner'));

-- Recreate profiles policy for owners to view all
CREATE POLICY "Owners can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'owner'));

-- Update RLS policies for jobs, customers, watches, inspections to restrict staff to view-only
-- Jobs: Staff can only view, Owner/Manager can do everything
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON public.jobs;

CREATE POLICY "Owner and Manager can create jobs"
ON public.jobs
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update jobs"
ON public.jobs
FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete jobs"
ON public.jobs
FOR DELETE
USING (can_edit_data(auth.uid()));

-- Customers: Staff can only view, Owner/Manager can do everything
DROP POLICY IF EXISTS "Authenticated users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;

CREATE POLICY "Owner and Manager can create customers"
ON public.customers
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update customers"
ON public.customers
FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete customers"
ON public.customers
FOR DELETE
USING (can_edit_data(auth.uid()));

-- Watches: Staff can only view, Owner/Manager can do everything
DROP POLICY IF EXISTS "Authenticated users can create watches" ON public.watches;
DROP POLICY IF EXISTS "Authenticated users can update watches" ON public.watches;
DROP POLICY IF EXISTS "Authenticated users can delete watches" ON public.watches;

CREATE POLICY "Owner and Manager can create watches"
ON public.watches
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update watches"
ON public.watches
FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete watches"
ON public.watches
FOR DELETE
USING (can_edit_data(auth.uid()));

-- Inspections: Staff can only view, Owner/Manager can do everything
DROP POLICY IF EXISTS "Authenticated users can create inspections" ON public.inspections;
DROP POLICY IF EXISTS "Authenticated users can update inspections" ON public.inspections;
DROP POLICY IF EXISTS "Authenticated users can delete inspections" ON public.inspections;

CREATE POLICY "Owner and Manager can create inspections"
ON public.inspections
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update inspections"
ON public.inspections
FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete inspections"
ON public.inspections
FOR DELETE
USING (can_edit_data(auth.uid()));

-- Email templates: Staff can only view, Owner/Manager can do everything
DROP POLICY IF EXISTS "Authenticated users can create email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON public.email_templates;

CREATE POLICY "Owner and Manager can create email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update email templates"
ON public.email_templates
FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete email templates"
ON public.email_templates
FOR DELETE
USING (can_edit_data(auth.uid()));