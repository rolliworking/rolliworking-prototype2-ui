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
  | 'station_reset';

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

export interface EstimateLine {
  description: string;
  qty: number;
  unitPrice: number;
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
