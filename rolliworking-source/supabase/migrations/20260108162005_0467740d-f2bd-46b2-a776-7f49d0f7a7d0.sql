-- Add data export permission
INSERT INTO public.permissions (key, name, description, category)
VALUES ('data.export', 'Data Export', 'Can export data as CSV files', 'admin')
ON CONFLICT (key) DO NOTHING;

-- Grant data.export permission to owner role
INSERT INTO public.role_permissions (role, permission_key)
VALUES ('owner', 'data.export')
ON CONFLICT DO NOTHING;