-- Add page-level view permissions for Email Templates, Dashboard, and History
INSERT INTO permissions (key, name, description, category) VALUES
  ('email_templates.view', 'View Email Templates', 'Access email templates page', 'Email Templates'),
  ('email_templates.edit', 'Edit Email Templates', 'Modify email templates', 'Email Templates'),
  ('dashboard.view', 'View Dashboard', 'Access the dashboard page', 'Dashboard'),
  ('history.view', 'View History', 'Access job history page', 'History'),
  ('parts_history.view', 'View Parts History', 'Access parts request history page', 'History');

-- Grant all these permissions to owner and manager by default
INSERT INTO role_permissions (role, permission_key) VALUES
  ('owner', 'email_templates.view'),
  ('owner', 'email_templates.edit'),
  ('owner', 'dashboard.view'),
  ('owner', 'history.view'),
  ('owner', 'parts_history.view'),
  ('manager', 'email_templates.view'),
  ('manager', 'email_templates.edit'),
  ('manager', 'dashboard.view'),
  ('manager', 'history.view'),
  ('manager', 'parts_history.view'),
  ('staff', 'dashboard.view'),
  ('staff', 'history.view'),
  ('staff', 'parts_history.view');