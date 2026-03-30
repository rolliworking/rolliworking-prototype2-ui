// Estimate and Service Types

export type SimpleJobStatus = 'estimate' | 'on_hand' | 'finished';

export type ServiceType = 'watch_service' | 'bracelet_service' | 'other_service' | 'warranty_service';

export type EstimateStatus = 'draft' | 'sent' | 'converted' | 'expired' | 'declined';

export type CustodyStatus = 'in_custody' | 'released';

export type LineType = 'service' | 'part' | 'shipping' | 'other';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceSubcategory {
  id: string;
  category_id: string;
  service_code: string;
  name: string;
  description: string | null;
  service_type: ServiceType;
  default_price: number | null;
  default_duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  category?: ServiceCategory;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  job_id: string | null;
  customer_id: string;
  watch_id: string | null;
  status: EstimateStatus;
  valid_until: string | null;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  watch?: {
    id: string;
    brand: string;
    model: string | null;
    serial_number: string | null;
    reference_number: string | null;
  };
}

export interface EstimateLineItem {
  id: string;
  estimate_id: string;
  line_type: LineType;
  service_subcategory_id: string | null;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  extended_price: number;
  taxable: boolean;
  internal_cost: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  // Joined
  service_subcategory?: ServiceSubcategory;
  part?: {
    id: string;
    part_number: string;
    description: string;
  };
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service_name: string;
  base_rate: number;
  insurance_rate_per_1000: number;
  max_insured_value: number | null;
  min_insured_value: number;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopTimeEntry {
  id: string;
  job_id: string | null;
  user_id: string | null;
  service_subcategory_id: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_manual_entry: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Form types
export interface EstimateFormData {
  customer_id: string;
  watch_id?: string;
  valid_until?: string;
  notes?: string;
  internal_notes?: string;
  estimate_number?: string;
}

export interface EstimateLineItemFormData {
  line_type: LineType;
  service_subcategory_id?: string;
  part_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  internal_cost?: number;
  notes?: string;
}

// Constants for UI
export const SIMPLE_JOB_STATUS_LABELS: Record<SimpleJobStatus, string> = {
  estimate: 'Estimate',
  on_hand: 'On Hand',
  finished: 'Finished',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  watch_service: 'Watch Service',
  bracelet_service: 'Bracelet Service',
  other_service: 'Other Service',
  warranty_service: 'Warranty Service',
};

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  converted: 'Converted',
  expired: 'Expired',
  declined: 'Declined',
};

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  service: 'Service',
  part: 'Part',
  shipping: 'Shipping',
  other: 'Other',
};

// Tax rate (configurable later)
export const TAX_RATE = 0.0825; // 8.25%
