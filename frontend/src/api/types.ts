export type AccessTier = 'manager' | 'concierge';

export interface User {
  id: string;
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
  | 'intake';

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

export type EstimateStatus = 'draft' | 'sent' | 'awaiting_approval' | 'approved' | 'declined' | 'expired';

export type DeptCode = 'W' | 'B' | 'P' | 'PM';

export interface EstimateLine {
  description: string;
  qty: number;
  unitPrice: number;
  dept: DeptCode;
}

export interface Estimate {
  id: string;
  number: string;
  clientId: string;
  watchId: string;
  department: Department;
  status: EstimateStatus;
  lines: EstimateLine[];
  total: number;
  concerns: string;
  createdAt: string;
  sentAt?: string;
}

export type JobStatus =
  | 'queued'
  | 'in_progress'
  | 'awaiting_parts'
  | 'qc'
  | 'complete'
  | 'awaiting_pickup'
  | 'shipped';

export interface Job {
  id: string;
  number: string;
  estimateId?: string;
  clientId: string;
  watchId: string;
  department: Department;
  status: JobStatus;
  technician: string;
  startedAt: string;
  dueAt: string;
  completedAt?: string;
  total: number;
}

export type Priority = 'high' | 'normal' | 'low';

export interface HitListItem {
  id: string;
  title: string;
  ownerShortName: string;
  priority: Priority;
  done: boolean;
  dueAt: string;
  relatedRef?: string;
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

export type EstimateWithRefs = Estimate & { client: Client; watch: Watch };
export type JobWithRefs = Job & { client: Client; watch: Watch };

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
