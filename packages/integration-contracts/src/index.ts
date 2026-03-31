// ==============================================
// RolliWorking ↔ RolliSuite Integration Contracts
// ==============================================
// Shared event types and data structures for integration
// between workshop app (RolliWorking) and main ERP (RolliSuite)
// ==============================================

// ==============================================
// WEBHOOK EVENT TYPES
// ==============================================

/**
 * Base webhook event structure
 */
export interface WebhookEvent<T = any> {
  eventId: string; // Unique event ID for idempotency
  eventType: string;
  timestamp: string; // ISO 8601
  source: 'rolliworking' | 'rollisuite';
  payload: T;
  version?: string; // API version
}

// ==============================================
// JOB STATUS EVENTS
// ==============================================

export type JobStatus =
  | 'intake'
  | 'in_review'
  | 'awaiting_customer_approval'
  | 'approved'
  | 'in_service'
  | 'testing'
  | 'ready_to_ship'
  | 'closed';

/**
 * Job status update event from RolliWorking → RolliSuite
 */
export interface JobStatusUpdateEvent {
  jobId: string;
  estimateNumber?: string; // EST-XXXXX or EXXXXX format
  previousStatus?: JobStatus;
  newStatus: JobStatus;
  updatedBy?: string; // User ID or name
  notes?: string;
  timestamp: string;
}

/**
 * Watchmaker assignment event from RolliWorking → RolliSuite
 */
export interface WatchmakerAssignmentEvent {
  jobId: string;
  estimateNumber?: string;
  watchmakerId: string;
  watchmakerName?: string;
  assignedBy?: string;
  timestamp: string;
}

/**
 * Job finished/completion event from RolliWorking → RolliSuite
 */
export interface JobFinishedEvent {
  jobId: string;
  estimateNumber?: string;
  completedBy?: string;
  completionNotes?: string;
  timestamp: string;
  testResults?: {
    timing?: any;
    pressure?: any;
    visual?: any;
  };
}

// ==============================================
// PARTS APPROVAL EVENTS
// ==============================================

/**
 * Parts approval event from RolliWorking → RolliSuite
 * Customer approved parts via email link
 */
export interface PartsApprovedEvent {
  eventId: string; // For idempotency
  estimateNumber: string; // EST-XXXXX or EXXXXX
  customerId?: string;
  approvedParts: Array<{
    partId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  customerEmail?: string;
  approvedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// ==============================================
// T&C ACCEPTANCE EVENTS
// ==============================================

/**
 * Terms & Conditions acceptance event from RolliWorking → RolliSuite
 */
export interface TcAcceptanceEvent {
  estimateNumber: string;
  customerId?: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
  signatureData?: string; // Base64 signature image
}

// ==============================================
// DAILY HIT LIST
// ==============================================

export interface HitListItem {
  jobId: string;
  estimateNumber: string;
  customerName: string;
  brand?: string;
  model?: string;
  status: JobStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
  notes?: string;
  category: 'overdue' | 'due_today' | 'due_this_week' | 'parts_pending' | 'needs_attention' | 'completed';
}

/**
 * Daily Hit List event from RolliWorking → RolliSuite
 * Full replacement of hit list data (not incremental)
 */
export interface DailyHitListEvent {
  generatedAt: string;
  items: HitListItem[];
  metadata?: {
    totalJobs: number;
    overdueCount: number;
    dueTodayCount: number;
    dueThisWeekCount: number;
    partsPendingCount: number;
    needsAttentionCount: number;
    completedCount: number;
  };
}

// ==============================================
// INSPECTION & TESTING EVENTS
// ==============================================

/**
 * Inspection notes event from RolliWorking → RolliSuite
 */
export interface InspectionEvent {
  jobId: string;
  estimateNumber?: string;
  inspectionType: 'visual' | 'timing' | 'pressure' | 'functional';
  performedBy?: string;
  notes: string;
  photos?: string[]; // URLs or base64
  results?: any; // Inspection-specific results
  timestamp: string;
}

/**
 * Test results event from RolliWorking → RolliSuite
 */
export interface TestResultsEvent {
  jobId: string;
  estimateNumber?: string;
  testType: 'timing' | 'pressure' | 'water_resistance';
  performedBy?: string;
  passed: boolean;
  results: {
    timing?: {
      position: string;
      rate: string;
      beatError?: string;
      amplitude?: string;
    };
    pressure?: {
      pressure: string;
      result: string;
    };
  };
  timestamp: string;
}

// ==============================================
// ROLLISUITE → ROLLIWORKING API CONTRACTS
// ==============================================

/**
 * Push new job to RolliWorking
 */
export interface PushJobToWorkshopRequest {
  jobId: string;
  estimateNumber: string;
  customerId: string;
  customerName: string;
  watch: {
    brand?: string;
    model?: string;
    referenceNumber?: string;
    serialNumber?: string;
  };
  serviceType?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  notes?: string;
  estimateLineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Query job status from RolliWorking
 */
export interface QueryJobStatusRequest {
  jobId: string;
}

export interface QueryJobStatusResponse {
  jobId: string;
  status: JobStatus;
  assignedTo?: string;
  lastUpdated: string;
  notes?: string;
}

/**
 * Sync model references to RolliWorking
 */
export interface SyncModelReferencesRequest {
  models: Array<{
    brand: string;
    model?: string;
    referenceNumber?: string;
    caliber?: string;
    metadata?: any;
  }>;
}

// ==============================================
// ERROR RESPONSES
// ==============================================

export interface IntegrationError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// ==============================================
// WEBHOOK SIGNATURES
// ==============================================

/**
 * Webhook signature verification
 */
export interface WebhookSignature {
  signature: string; // HMAC-SHA256
  timestamp: string;
  algorithm: 'HMAC-SHA256';
}

// ==============================================
// EXPORTS
// ==============================================

export type RolliWorkingEvent =
  | WebhookEvent<JobStatusUpdateEvent>
  | WebhookEvent<WatchmakerAssignmentEvent>
  | WebhookEvent<JobFinishedEvent>
  | WebhookEvent<PartsApprovedEvent>
  | WebhookEvent<TcAcceptanceEvent>
  | WebhookEvent<DailyHitListEvent>
  | WebhookEvent<InspectionEvent>
  | WebhookEvent<TestResultsEvent>;

export const EVENT_TYPES = {
  // RolliWorking → RolliSuite
  JOB_STATUS_UPDATE: 'job.status.updated',
  WATCHMAKER_ASSIGNED: 'job.watchmaker.assigned',
  JOB_FINISHED: 'job.finished',
  PARTS_APPROVED: 'parts.approved',
  TC_ACCEPTED: 'tc.accepted',
  DAILY_HIT_LIST: 'hit_list.updated',
  INSPECTION_COMPLETED: 'inspection.completed',
  TEST_COMPLETED: 'test.completed',

  // RolliSuite → RolliWorking
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  MODEL_REFERENCE_SYNC: 'model_reference.sync',
} as const;
