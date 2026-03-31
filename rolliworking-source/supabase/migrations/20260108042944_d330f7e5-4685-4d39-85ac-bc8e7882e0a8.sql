-- Add reports.view permission
INSERT INTO public.permissions (key, name, category, description)
VALUES ('reports.view', 'View Reports', 'reports', 'Access to view reports and analytics')
ON CONFLICT (key) DO NOTHING;

-- Grant reports.view to all roles by default
INSERT INTO public.role_permissions (role, permission_key)
VALUES 
  ('owner', 'reports.view'),
  ('manager', 'reports.view'),
  ('staff', 'reports.view')
ON CONFLICT DO NOTHING;