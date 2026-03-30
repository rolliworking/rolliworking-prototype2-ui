// Database types for Rolliworks
export type JobStatus = 
  | 'intake'
  | 'awaiting_customer_approval'
  | 'approved'
  | 'in_service'
  | 'testing'
  | 'ready_to_ship'
  | 'closed';

export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

export type AppRole = 'admin' | 'manager' | 'office' | 'staff';

export type PressureTestMethod = 'dry' | 'wet' | 'both';

export type PressureTestResult = 'passed' | 'failed';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  middle_name: string | null;
  suffix: string | null;
  company_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  website: string | null;
  internal_notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  email_normalized: string | null;
  phone_normalized: string | null;
  qbo_customer_id: string | null;
  parent_customer_id: string | null;
  is_organization: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_type: 'billing' | 'shipping';
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  is_same_as_billing: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerCommunicationPermissions {
  id: string;
  customer_id: string;
  consent_email: string | null;
  consent_recorded: boolean;
  consent_recorded_at: string | null;
  consent_recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Watch {
  id: string;
  customer_id: string;
  brand: string;
  model: string | null;
  reference_number: string | null;
  serial_number: string | null;
  movement_type: string | null;
  case_material: string | null;
  band_material: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  job_id: string;
  estimate_number: string | null;
  quickbooks_invoice_id: string | null;
  customer_id: string;
  watch_id: string;
  status: JobStatus;
  priority: PriorityLevel;
  due_date: string | null;
  intake_notes: string | null;
  condition_notes: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: Customer;
  watch?: Watch;
}

export interface JobStatusHistory {
  id: string;
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobActivityLog {
  id: string;
  job_id: string;
  action_type: 'Created' | 'Updated' | 'StatusChanged' | 'TestAdded' | 'TestEdited' | 'PDFGenerated';
  message: string;
  user_id: string | null;
  created_at: string;
}

export interface TimingTest {
  id: string;
  job_id: string;
  test_date: string;
  machine: string | null;
  lift_angle: number | null;
  rate: number | null;
  amplitude: number | null;
  beat_error: number | null;
  position_dial_up_rate: number | null;
  position_dial_up_amplitude: number | null;
  position_dial_down_rate: number | null;
  position_dial_down_amplitude: number | null;
  position_crown_up_rate: number | null;
  position_crown_up_amplitude: number | null;
  position_crown_down_rate: number | null;
  position_crown_down_amplitude: number | null;
  position_crown_left_rate: number | null;
  position_crown_left_amplitude: number | null;
  position_crown_right_rate: number | null;
  position_crown_right_amplitude: number | null;
  notes: string | null;
  tested_by: string | null;
  created_at: string;
}

export interface PressureTest {
  id: string;
  job_id: string;
  test_date: string;
  tester: string | null;
  method: string | null;
  target_bar: number | null;
  result_passed: boolean;
  notes: string | null;
  tested_by: string | null;
  created_at: string;
}

export interface LineItem {
  id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  internal_cost: number | null;
  taxable: boolean;
  category: string | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  job_id: string | null;
  timing_test_id: string | null;
  pressure_test_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface QuickBooksSyncLog {
  id: string;
  job_id: string;
  action: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  synced_by: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mask_serial_on_print: boolean;
  serial_mask_rule: string;
  created_at: string;
  updated_at: string;
}

// Form types
export interface CustomerFormData {
  first_name: string;
  last_name: string;
  title?: string;
  middle_name?: string;
  suffix?: string;
  company_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  website?: string;
  internal_notes?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  parent_customer_id?: string | null;
  is_organization?: boolean;
}

export interface CustomerAddressFormData {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  is_same_as_billing?: boolean;
}

export interface CustomerCommunicationFormData {
  consent_email?: string;
  consent_recorded?: boolean;
}

export interface WatchFormData {
  brand: string;
  model?: string;
  reference_number?: string;
  serial_number?: string;
  movement_type?: string;
  case_material?: string;
  band_material?: string;
  notes?: string;
}

export interface JobFormData {
  job_id: string;
  estimate_number?: string;
  status: JobStatus;
  priority: PriorityLevel;
  due_date?: string;
  intake_notes?: string;
  condition_notes?: string;
}

export interface TimingTestFormData {
  test_date: string;
  machine?: string;
  lift_angle?: number;
  rate?: number;
  amplitude?: number;
  beat_error?: number;
  notes?: string;
}

export interface PressureTestFormData {
  test_date: string;
  tester?: string;
  method?: string;
  target_bar?: number;
  result_passed: boolean;
  notes?: string;
}

export interface LineItemFormData {
  description: string;
  quantity: number;
  unit_price: number;
  internal_cost?: number;
  taxable: boolean;
  category?: string;
  vendor?: string;
  notes?: string;
}

// Permission helpers
export interface RolePermissions {
  canDeleteJobs: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canAccessSetup: boolean;
  canExportCSV: boolean;
  canEditTestsAnytime: boolean;
  canEditTestsWithin24Hours: boolean;
  canAccessIntake: boolean;
  canAccessInspections: boolean;
  canAccessReceiveWatch: boolean;
  canAccessReportAnalytics: boolean;
}

export type PermissionKey = keyof RolePermissions;

export const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  admin: {
    canDeleteJobs: true,
    canManageUsers: true,
    canManageSettings: true,
    canAccessSetup: true,
    canExportCSV: true,
    canEditTestsAnytime: true,
    canEditTestsWithin24Hours: true,
    canAccessIntake: true,
    canAccessInspections: true,
    canAccessReceiveWatch: true,
    canAccessReportAnalytics: true,
  },
  manager: {
    canDeleteJobs: false,
    canManageUsers: false,
    canManageSettings: false,
    canAccessSetup: false,
    canExportCSV: true,
    canEditTestsAnytime: true,
    canEditTestsWithin24Hours: true,
    canAccessIntake: true,
    canAccessInspections: true,
    canAccessReceiveWatch: true,
    canAccessReportAnalytics: true,
  },
  office: {
    canDeleteJobs: false,
    canManageUsers: false,
    canManageSettings: false,
    canAccessSetup: false,
    canExportCSV: false,
    canEditTestsAnytime: false,
    canEditTestsWithin24Hours: true,
    canAccessIntake: true,
    canAccessInspections: true,
    canAccessReceiveWatch: true,
    canAccessReportAnalytics: false,
  },
  staff: {
    canDeleteJobs: false,
    canManageUsers: false,
    canManageSettings: false,
    canAccessSetup: false,
    canExportCSV: false,
    canEditTestsAnytime: false,
    canEditTestsWithin24Hours: true,
    canAccessIntake: false,
    canAccessInspections: false,
    canAccessReceiveWatch: false,
    canAccessReportAnalytics: false,
  },
};
