export type AccessTier = 'manager' | 'concierge';

export type Role = 'concierge' | 'manager' | 'inspector' | 'watchmaker';

export interface User {
  id: string;
  roles: Role[];
  firstName: string;
  shortName: string;
  displayName: string;
  dutyLabel: string;
  accessTier: AccessTier;
  password: string;
  pin: string;
}

export interface Station {
  id: string;
  name: string;
}

export type CameraStatus = 'captured' | 'no_camera' | 'denied';
export type SignInMethod = 'password_photo' | 'pin_switch';

export interface VerificationPhoto {
  dataUrl: string | null;
  cameraStatus: CameraStatus;
}

export type AuditEventType =
  | 'sign_in'
  | 'sign_in_failed'
  | 'sign_out'
  | 'station_registered'
  | 'station_renamed'
  | 'station_reset'
  | 'intake'
  | 'estimate'
  | 'job'
  | 'task'
  | 'pin';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  stationName: string;
  userShortName?: string;
  userDisplayName?: string;
  method?: SignInMethod;
  cameraStatus?: CameraStatus;
  photoDataUrl?: string;
  detail: string;
}

export type ClientType = 'retail' | 'trade';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  street: string;
  city: string;
  state: string;
  type: ClientType;
  since: string;
}

export type WatchStatus =
  | 'expected'
  | 'intake'
  | 'in_service'
  | 'awaiting_approval'
  | 'awaiting_parts'
  | 'qc'
  | 'awaiting_pickup'
  | 'released';

export interface Watch {
  id: string;
  clientId: string;
  brand: 'Rolex' | 'Tudor';
  model: string;
  reference: string;
  serial: string;
  dial: string;
  bracelet: string;
  status: WatchStatus;
  receivedAt: string;
}

export type Department = 'watchmaking' | 'band' | 'polish';

export type DeptCode = 'W' | 'B' | 'P' | 'PM';

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'converted' | 'expired' | 'declined';
export type LineType = 'service' | 'part' | 'shipping';

export interface EstimateLine {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  dept: DeptCode;
  taxable: boolean;
  type: LineType;
  catalogId?: string;
  partNumber?: string;
}

export interface Address {
  name: string;
  street: string;
  city: string;
  state: string;
}

export interface EstimateRevision {
  revision: number;
  status: EstimateStatus;
  lines: EstimateLine[];
  subtotal: number;
  shippingAmount: number;
  total: number;
  validUntil: string;
  clientNotes: string;
  messageNotes: string;
  internalNotes: string;
  savedAt: string;
  savedBy: string;
}

export interface Estimate {
  id: string;
  number: string;
  revision: number;
  revisions: EstimateRevision[];
  clientId: string;
  watchId?: string;
  department: Department;
  status: EstimateStatus;
  lines: EstimateLine[];
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
  validUntil: string;
  clientNotes: string;
  messageNotes: string;
  internalNotes: string;
  billingAddress: Address;
  shippingAddress: Address;
  shippingMirrorsBilling: boolean;
  historical: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  sentAt?: string;
  convertedAt?: string;
  approvedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  jobId?: string;
}

export interface CatalogService {
  id: string;
  name: string;
  dept: DeptCode;
  rate: number;
  type: LineType;
}

export interface QuoteContext {
  clientEstimates: EstimateWithRefs[];
  watchEstimates: EstimateWithRefs[];
}

// ---- Jobs (E4) — enums per PROMPT-PACK-jobs.md (DB enums win over app lists) ----

export type JobStatus = 'intake' | 'in_review' | 'awaiting_customer_approval' | 'approved' | 'in_service' | 'testing' | 'ready_to_ship' | 'closed';
export type JobSimpleStatus = 'estimate' | 'on_hand' | 'finished';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type HoldType = 'parts' | 'outsource';
export type JobKind = 'service' | 'small_job' | 'warranty';

export interface Stamp {
  at: string;
  by: string;
  station: string;
}

export interface JobTransition extends Stamp {
  id: string;
  from: JobStatus | null;
  to: JobStatus;
  action: string;
  reason?: string;
  emailQueued?: boolean;
}

export interface JobHold {
  id: string;
  type: HoldType;
  reason: string;
  priorStatus: JobStatus;
  placedAt: string;
  placedBy: string;
  station: string;
  releasedAt?: string;
  releasedBy?: string;
  releaseNote?: string;
}

export interface JobNote extends Stamp {
  id: string;
  text: string;
}

export type JobPhoto = PackagePhoto & Stamp;

// Multiple-choice inspection report (service kind only — MH ruling); photos are required for every kind
export interface InspectionReport extends Stamp {
  answers: Record<string, string>;
}

export interface ShopTimeEntry extends Stamp {
  id: string;
  jobId: string;
  minutes: number;
  note: string;
}

export interface Job {
  id: string;
  number: string;
  clientId: string;
  watchId: string;
  estimateId?: string;
  packageId?: string;
  department: Department;
  workflow: DeptCode[];
  kind: JobKind;
  status: JobStatus;
  simpleStatus: JobSimpleStatus;
  priority: JobPriority;
  lines: EstimateLine[];
  total: number;
  owner?: Role;
  assignees: string[];
  intakeDate?: string;
  intakeNotes?: string;
  conditionNotes?: string;
  dueAt?: string;
  finishedAt?: string;
  createdAt: string;
  createdBy: string;
  timeline: JobTransition[];
  holds: JobHold[];
  notes: JobNote[];
  photos: JobPhoto[];
  inspection?: InspectionReport;
}

// ---- Tasks (explicit 20%) + derived /today rows -----------------------------

export type Assignee = { type: 'user'; shortName: string } | { type: 'role'; role: Role };

export interface Task {
  id: string;
  title: string;
  assignedTo: Assignee;
  createdBy: string;
  jobId?: string;
  watchId?: string;
  clientId?: string;
  dueAt?: string;
  status: 'open' | 'done';
  createdAt: string;
  station: string;
  completedAt?: string;
  completedBy?: string;
}

// Manual layer: pinned hit-list items (MH ruling) — sit above the derived rows, never hide them
export interface PinnedItem {
  id: string;
  title: string;
  assignedTo: Assignee;
  createdBy: string;
  jobId?: string;
  taskId?: string;
  createdAt: string;
  station: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

export type TodaySource = 'owner' | 'assignee' | 'hold' | 'discrepancy' | 'task';

export interface TodayRow {
  id: string;
  source: TodaySource;
  title: string;
  detail: string;
  via: string;
  jobId?: string;
  taskId?: string;
  packageId?: string;
  dueAt?: string;
  overdue: boolean;
  urgent: boolean;
  sentBy?: string;
}

export interface TodayView {
  pinned: PinnedItem[];
  rows: TodayRow[];
  waitingOn: Task[];
}

export type ActivityType =
  | 'package_received'
  | 'estimate_sent'
  | 'estimate_viewed'
  | 'estimate_declined'
  | 'job_started'
  | 'job_completed'
  | 'photo_uploaded'
  | 'pickup'
  | 'parts_ordered'
  | 'qc_passed';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  message: string;
  actor: string;
  timestamp: string;
}

export interface DepartmentPnl {
  key: Department;
  name: string;
  mtdRevenue: number;
  jobCount: number;
}

export interface DashboardStats {
  watchesInHouse: number;
  openEstimates: number;
  awaitingApproval: number;
  inProgress: number;
  awaitingPickup: number;
  revenueThisMonth: number;
  departments: DepartmentPnl[];
}

export type EstimateWithRefs = Estimate & { client: Client; watch: Watch | null };
export type JobWithRefs = Job & { client: Client; watch: Watch; estimate: Estimate | null; pkg: Package | null };

// ---- Intake -----------------------------------------------------------------

export type PackageStatus = 'arrived' | 'processed' | 'awaiting_inspection' | 'received' | 'discrepancy_hold';
export type PackageSource = 'carrier' | 'walk_in';
export type Carrier = 'FedEx' | 'UPS' | 'USPS' | 'DHL' | 'Hand delivery';
export type Bin = 'inspection' | 'concierge';

export interface PackagePhoto {
  id: string;
  source: 'webcam' | 'upload';
  dataUrl: string;
  fileName?: string;
}

export interface Package {
  id: string;
  subNumber: string;
  source: PackageSource;
  carrier: Carrier;
  trackingNumber?: string;
  signatureNoted: boolean;
  clientId?: string;
  estimateId?: string;
  status: PackageStatus;
  arrivedAt: string;
  arrivedBy: string;
  arrivedStation: string;
  contents: string[];
  photos: PackagePhoto[];
  receiptPrinted: boolean;
  processedAt?: string;
  processedBy?: string;
  workOrderAt?: string;
  workOrderBy?: string;
  bin?: Bin;
  inspectedAt?: string;
  inspectedBy?: string;
  workflow?: DeptCode[];
  discrepancyReason?: string;
  notes?: string;
}

export type PackageWithRefs = Package & { client: Client | null; estimate: EstimateWithRefs | null };

export interface OutboxEmail {
  id: string;
  to: string;
  toName: string;
  subject: string;
  body: string;
  relatedRef: string;
  createdAt: string;
  createdBy: string;
  station: string;
  status: 'pending';
}

export type LabelType = 'pdf417_data' | 'ref_serial';

export interface LabelJob {
  id: string;
  type: LabelType;
  packageId: string;
  estimateNumber: string;
  payload: string;
  lines: string[];
  createdAt: string;
  createdBy: string;
  station: string;
  printed: boolean;
}

export interface WatchMatch {
  watch: Watch;
  client: Client;
  jobs: Job[];
  packages: Package[];
}

export interface InspectionContext {
  pkg: PackageWithRefs;
  estimate: EstimateWithRefs;
  expectedComponents: string[];
  suggestedWorkflow: DeptCode[];
}

export interface ReceiveWatchInput {
  reference: string;
  serial: string;
  linesVerified: number[];
  componentsReceived: string[];
  extraWatch: boolean;
  workflow: DeptCode[];
  sameWatchDecision: 'n/a' | 'returning' | 'conflict';
  notes?: string;
}
