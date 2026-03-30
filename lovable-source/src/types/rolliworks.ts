// ============================================================
// ROLLIWORKS COMPREHENSIVE TYPE DEFINITIONS
// Aligned with actual database schema
// ============================================================

// Job Status Model (LOCKED - 3 states only)
export type SimpleJobStatus = 'on_hand' | 'inspected' | 'finished';

export const SIMPLE_JOB_STATUS_LABELS: Record<SimpleJobStatus, string> = {
  on_hand: 'On Hand',
  inspected: 'Inspected',
  finished: 'Finished',
};

export const SIMPLE_JOB_STATUS_ORDER: SimpleJobStatus[] = ['on_hand', 'inspected', 'finished'];

// Service Types (enum, drives logic)
export type ServiceType = 'watch_service' | 'bracelet_service' | 'other_service' | 'warranty_service';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  watch_service: 'Watch Service',
  bracelet_service: 'Bracelet Service',
  other_service: 'Other Service',
  warranty_service: 'Warranty Service',
};

// Service Code Prefixes
export const SERVICE_CODE_PREFIXES = {
  WM: 'Watch Movement',
  B: 'Bracelet Repair',
  P: 'Polishing / Case Work',
  SH: 'Shop Time Products',
  SM: 'Small Jobs',
  WR: 'Warranty',
} as const;

// Estimate Status
export type EstimateStatus = 'draft' | 'sent' | 'converted';

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  converted: 'Converted',
};

// Custody Status
export type CustodyStatus = 'in_custody' | 'released';

export const CUSTODY_STATUS_LABELS: Record<CustodyStatus, string> = {
  in_custody: 'In Custody',
  released: 'Released',
};

// Line Item Types
export type LineItemType = 'service' | 'part' | 'other' | 'shipping';

export const LINE_ITEM_TYPE_LABELS: Record<LineItemType, string> = {
  service: 'Service',
  part: 'Part',
  other: 'Other',
  shipping: 'Shipping',
};

// Cycle Count Status
export type CycleCountStatus = 'draft' | 'in_progress' | 'submitted' | 'approved' | 'posted';

export const CYCLE_COUNT_STATUS_LABELS: Record<CycleCountStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  posted: 'Posted',
};

// Item Types for Shipping
export type ShippingItemType = 'WATCH' | 'BRACELET' | 'OTHER';

export const SHIPPING_ITEM_TYPE_LABELS: Record<ShippingItemType, string> = {
  WATCH: 'Watch',
  BRACELET: 'Bracelet',
  OTHER: 'Other',
};

// ============================================================
// INTERFACES (Aligned with actual DB schema)
// ============================================================

export interface Customer {
  id: string;
  customer_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
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
  watch_tag_number: string | null;
  movement_type: string | null;
  case_material: string | null;
  band_material: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Job {
  id: string;
  job_id: string;
  customer_id: string;
  watch_id: string;
  estimate_id: string | null;
  simple_status: SimpleJobStatus | null;
  intake_date: string | null;
  finished_date: string | null;
  intake_notes: string | null;
  condition_notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  watch?: Watch;
  estimate?: Estimate;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ServiceSubcategory {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  service_code: string | null;
  service_type: ServiceType | null;
  default_price: number;
  default_duration_minutes: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: ServiceCategory;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  watch_id: string | null;
  job_id: string | null;
  status: EstimateStatus;
  subtotal: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  internal_notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  watch?: Watch;
}

export interface EstimateLineItem {
  id: string;
  estimate_id: string;
  line_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  extended_price: number;
  taxable: boolean;
  internal_cost: number | null;
  service_subcategory_id: string | null;
  service_code: string | null;
  part_id: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  service_subcategory?: ServiceSubcategory;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service_name: string;
  base_rate: number;
  insurance_rate_per_1000: number;
  min_insured_value: number | null;
  max_insured_value: number | null;
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
  job?: Job;
  service_subcategory?: ServiceSubcategory;
}

export interface Location {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  store_code: string | null;
  location_code: string | null;
  barcode_value: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CycleCount {
  id: string;
  count_number: string;
  store_id: string | null;
  location_id: string | null;
  bin_id: string | null;
  status: string;
  count_date: string;
  requires_approval: boolean | null;
  total_variance_qty: number | null;
  total_variance_value: number | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// FORM DATA TYPES
// ============================================================

export interface EstimateLineItemFormData {
  line_type: LineItemType;
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  internal_cost?: number;
  service_subcategory_id?: string;
  service_code?: string;
  part_id?: string;
  notes?: string;
}

export interface ShippingCalculatorInput {
  item_type: ShippingItemType;
  insured_value: number;
}

export interface ShippingCalculatorResult {
  carrier: string;
  service_name: string;
  base_rate: number;
  insurance_cost: number;
  total_cost: number;
}

// ============================================================
// QR CODE DATA FORMAT
// ============================================================

export interface QRCodeData {
  name: string;
  email: string;
  phone: string;
  watch_ref: string;
  watch_serial: string;
  date_in: string;
  estimate_no: string;
  service_codes: string[];
}

export function formatQRCodeText(data: QRCodeData): string {
  return [
    `NAME: ${data.name}`,
    `EMAIL: ${data.email}`,
    `PHONE: ${data.phone}`,
    `WATCH_REF: ${data.watch_ref}`,
    `WATCH_SERIAL: ${data.watch_serial}`,
    `DATE_IN: ${data.date_in}`,
    `ESTIMATE_NO: ${data.estimate_no}`,
    `SERVICE_CODES: ${data.service_codes.join(',')}`,
  ].join('\n');
}

// ============================================================
// SMART INTAKE EMAIL LOGIC
// ============================================================

// Re-export from constants for convenience
export { RELATED_PART_CATEGORIES, type RelatedPartCategory } from '@/lib/constants';
import { RELATED_PART_CATEGORIES } from '@/lib/constants';

interface PartWithCategory {
  id: string;
  category?: string | null;
  item_type?: string;
}

export function generateIntakeEmailIntro(
  lineItems: EstimateLineItem[], 
  subcategories: ServiceSubcategory[],
  parts?: PartWithCategory[]
): string {
  // Collect related_part categories from service parts
  const relatedParts: string[] = [];
  
  if (parts && parts.length > 0) {
    // Use parts data if available
    lineItems.forEach(li => {
      if (li.part_id) {
        const part = parts.find(p => p.id === li.part_id);
        if (part?.item_type === 'service' && part.category) {
          relatedParts.push(part.category);
        }
      }
    });
  }
  
  // Fallback to service_type from subcategories if no parts data
  if (relatedParts.length === 0) {
    lineItems
      .filter(li => li.service_subcategory_id)
      .forEach(li => {
        const subcat = subcategories.find(s => s.id === li.service_subcategory_id);
        if (subcat?.service_type) {
          // Map legacy service_type to related_part
          if (subcat.service_type === 'watch_service') {
            relatedParts.push('watch');
          } else if (subcat.service_type === 'bracelet_service') {
            relatedParts.push('bracelet');
          }
        }
      });
  }
  
  // Count occurrences of each related part type
  const counts: Record<string, number> = {};
  relatedParts.forEach(rp => {
    counts[rp] = (counts[rp] || 0) + 1;
  });
  
  // Determine the primary item received
  const hasWatch = counts['watch'] > 0;
  const hasBracelet = counts['bracelet'] > 0;
  const hasCase = counts['watch_case'] > 0;
  const hasClasp = counts['clasp'] > 0;
  const hasBezel = counts['bezel'] > 0;
  
  // Build the items list for the email
  const items: string[] = [];
  
  if (hasWatch) items.push('watch');
  if (hasBracelet) items.push(counts['bracelet'] > 1 ? 'bracelets' : 'bracelet');
  if (hasCase) items.push('watch case');
  if (hasClasp) items.push(counts['clasp'] > 1 ? 'clasps' : 'clasp');
  if (hasBezel) items.push(counts['bezel'] > 1 ? 'bezels' : 'bezel');
  
  if (items.length === 0) {
    return "Thank you, we've received your item.";
  } else if (items.length === 1) {
    return `Thank you, we've received your ${items[0]}.`;
  } else if (items.length === 2) {
    return `Thank you, we've received your ${items[0]} and ${items[1]}.`;
  } else {
    const lastItem = items.pop();
    return `Thank you, we've received your ${items.join(', ')}, and ${lastItem}.`;
  }
}

// ============================================================
// CONSTANTS
// ============================================================

export const DEFAULT_TAX_RATE = 0.0825; // 8.25%
export const DEFAULT_SHOP_TIME_HOURLY_RATE = 125.00;
