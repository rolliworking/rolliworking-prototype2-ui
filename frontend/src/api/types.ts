export type AccessTier = 'manager' | 'concierge';

export interface User {
  id: string;
  badgeCode: string;
  shortName: string;
  displayName: string;
  dutyLabel: string;
  accessTier: AccessTier;
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
