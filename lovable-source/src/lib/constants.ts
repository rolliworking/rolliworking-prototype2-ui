import { JobStatus, PriorityLevel } from '@/types/database';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  intake: 'Intake',
  awaiting_customer_approval: 'Awaiting Approval',
  approved: 'Approved',
  in_service: 'In Service',
  testing: 'Testing',
  ready_to_ship: 'Ready to Ship',
  closed: 'Closed',
};

export const JOB_STATUS_ORDER: JobStatus[] = [
  'intake',
  'awaiting_customer_approval',
  'approved',
  'in_service',
  'testing',
  'ready_to_ship',
  'closed',
];

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const WATCH_BRANDS = [
  'Rolex',
  'Omega',
  'Patek Philippe',
  'Audemars Piguet',
  'Cartier',
  'IWC',
  'Jaeger-LeCoultre',
  'Panerai',
  'Breitling',
  'Tag Heuer',
  'Tudor',
  'Zenith',
  'Hublot',
  'Vacheron Constantin',
  'A. Lange & Söhne',
  'Blancpain',
  'Chopard',
  'Grand Seiko',
  'Other',
];

export const MOVEMENT_TYPES = [
  'Automatic',
  'Manual',
  'Quartz',
  'Spring Drive',
  'Solar',
  'Kinetic',
];

export const CASE_MATERIALS = [
  'Stainless Steel',
  'Yellow Gold',
  'White Gold',
  'Rose Gold',
  'Platinum',
  'Titanium',
  'Ceramic',
  'Bronze',
  'Two-Tone',
];

export const BAND_MATERIALS = [
  'Stainless Steel',
  'Yellow Gold',
  'White Gold',
  'Rose Gold',
  'Leather',
  'Rubber',
  'NATO',
  'Titanium',
  'Ceramic',
];

export const TIMING_MACHINES = [
  'Witschi Analyzer',
  'Timegrapher 1000',
  'Watch Expert II',
  'GEM Timing Machine',
  'Other',
];

export const PRESSURE_TEST_METHODS = [
  { value: 'dry', label: 'Dry' },
  { value: 'wet', label: 'Wet' },
  { value: 'both', label: 'Both' },
];

export const LINE_ITEM_CATEGORIES = [
  'Service',
  'Parts',
  'Labor',
  'Shipping',
  'Other',
];

export const TAX_RATE = 0.0825; // 8.25% Texas sales tax

export const DEFAULT_LIFT_ANGLE = 52;

// Related part categories for service items (used in smart intake emails)
export const RELATED_PART_CATEGORIES = [
  { value: 'watch', label: 'Watch' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'watch_case', label: 'Watch Case' },
  { value: 'clasp', label: 'Clasp' },
  { value: 'bezel', label: 'Bezel' },
] as const;

export type RelatedPartCategory = typeof RELATED_PART_CATEGORIES[number]['value'];

// Job ID validation
export const JOB_ID_REGEX = /^E\d+$/;

export const validateJobId = (jobId: string): boolean => {
  return JOB_ID_REGEX.test(jobId);
};

export const normalizeJobIdInput = (input: string): string => {
  // If input is just digits, prepend E
  const trimmed = input.trim().toUpperCase();
  if (/^\d+$/.test(trimmed)) {
    return 'E' + trimmed;
  }
  return trimmed;
};

export const formatJobIdForSearch = (input: string): string => {
  const trimmed = input.trim();
  // If it's just digits, treat as job ID without E prefix
  if (/^\d+$/.test(trimmed)) {
    return 'E' + trimmed;
  }
  return trimmed;
};
