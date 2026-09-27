export type AccessTier = 'manager' | 'concierge';

export type Role = 'concierge' | 'manager' | 'inspector' | 'watchmaker';

export type Division = 'rolliworks' | 'rollishop';

export interface User {
  id: string;
  roles: Role[];
  firstName: string;
  shortName: string;
  displayName: string;
  dutyLabel: string;
  accessTier: AccessTier;
  division: Division | 'both';
  password: string;
  pin: string;
}

export interface Station {
  id: string;
  name: string;
  division: Division;
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
  | 'pin'
  | 'sales'
  | 'parts'
  | 'portal'
  | 'purchasing'
  | 'inventory'
  | 'setup'
  | 'evidence'
  | 'labels'
  | 'accounting'
  | 'companion'
  | 'comms'
  | 'rollitime'
  | 'rgtime'
  | 'kiosk';

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
  managerShort?: string;
  internal?: boolean;
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
// Estimates-as-URLs engagement (opens, label request, drop-off intent, re-quote ask) — logged per estimate
export type EngagementKind = 'opened' | 'label_requested' | 'drop_off' | 'requote_requested' | 'approved' | 'declined';
export interface EngagementEvent { kind: EngagementKind; at: string; detail?: string }
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
  requiresApproval?: boolean;
  engagement?: EngagementEvent[];
  supersededById?: string;
  sendIntent?: { kind: 'label' | 'drop_off'; at: string; shipmentId?: string };
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
  requiresApproval?: boolean;
  engagement?: EngagementEvent[];
  supersededById?: string;
  sendIntent?: { kind: 'label' | 'drop_off'; at: string; shipmentId?: string };
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
  approvedVia?: 'staff' | 'portal';
  jobId?: string;
  requestId?: string;
  components?: DeptCode[];
  legacy?: LegacyMeta;
  convertedFromLegacy?: { id: string; number: string };
}
// Legacy archive records (display mock): read-only everywhere; a manager may convert into a native record, original untouched
export interface LegacyMeta { source: string; number: string; importedAt: string; convertedToId?: string }

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

export type JobStatus = 'intake' | 'in_review' | 'awaiting_customer_approval' | 'approved' | 'in_service' | 'testing' | 'awaiting_manager_review' | 'ready_to_ship' | 'closed';
export type JobSimpleStatus = 'estimate' | 'on_hand' | 'finished';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type HoldType = 'parts' | 'outsource';
export type JobKind = 'service' | 'small_job' | 'warranty' | 'trade';

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
  division: Division;
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
  components?: JobComponent[];
  clientRequests?: ClientRequest[];
}

// Client request notes — what the client asked for; surfaced on pad/wm cards, popped on every label scan, enforced at QC
export interface ClientRequestAck { at: string; by: string; via: string }
export interface ClientRequestCheck { at: string; by: string; result: 'done' | 'na'; reason?: string }
export interface ClientRequest extends Stamp { id: string; text: string; acks: ClientRequestAck[]; check?: ClientRequestCheck }
export interface ClientRequestAlert { jobId: string; jobNumber: string; watchLabel: string; requests: ClientRequest[] }
export interface StaffInboxRow { user: User; openAssigned: number }

// MH ruling (first board walk): per-component completion, decoupled from invoicing
export type ComponentKey = 'head' | 'band' | 'case';
export interface ComponentRework { at: string; reason: string; by: string }
export interface JobComponent {
  key: ComponentKey; label: string; depts: DeptCode[];
  completedAt?: string; completedBy?: string; completedStation?: string;
  amendedAt?: string; amendedBy?: string; amendedFrom?: string;
  rework: ComponentRework[];
  // E18 — physical part on the shop floor
  station?: RwStationKey; partStatus?: PartStatus; custodyTech?: string; history?: PartMove[];
}
export type PartStatus = 'not_started' | 'in_progress' | 'waiting' | 'reunited' | 'fulfilled';
export interface PartMove { at: string; by: string; from?: RwStationKey; to?: RwStationKey; status: PartStatus; via: 'drag' | 'scan' | 'bulk_assign' | 'wm' | 'pad' | 'station' | 'system' | 'audit_correction' | 'undo'; note?: string }
export interface TechCompletionRow { tech: string; months: Record<string, { total: number; byDept: Record<DeptCode, number> }>; total: number }
export interface CompletionsReport { months: string[]; rows: TechCompletionRow[]; generatedAt: string }

// ---- Tasks (explicit 20%) + derived /today rows -----------------------------

export type Assignee = { type: 'user'; shortName: string } | { type: 'role'; role: Role };

export interface Task {
  id: string;
  title: string;
  assignedTo: Assignee;
  createdBy: string;
  division: Division;
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
  division: Division;
  jobId?: string;
  taskId?: string;
  clientId?: string;
  estimateId?: string;
  messageId?: string;
  createdAt: string;
  station: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

export type TodaySource = 'owner' | 'assignee' | 'hold' | 'discrepancy' | 'task' | 'thread';

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
export type JobWithRefs = Job & { client: Client; watch: Watch; estimate: Estimate | null; pkg: Package | null; components: JobComponent[] };

// ---- Intake -----------------------------------------------------------------

export type PackageStatus = 'arrived' | 'processed' | 'awaiting_inspection' | 'received' | 'discrepancy_hold';
export type PackageSource = 'carrier' | 'walk_in';
export type Carrier = 'FedEx' | 'UPS' | 'USPS' | 'DHL' | 'Hand delivery';
export type Bin = 'inspection' | 'concierge';

export interface PackagePhoto {
  id: string;
  source: 'webcam' | 'upload' | 'camera';
  dataUrl: string;
  fileName?: string;
  slot?: string;
  clientVisible?: boolean;
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
  componentsVerified?: string[];
  b2b?: { tier: string; code: string; at: string };
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
  payLink?: string;
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

// ---- Sales orders / fulfil / pickup / ship (E5) — per PROMPT-PACK-invoicing-pickup-ship.md ----

export type SOStatus = 'draft' | 'open' | 'partial_fulfilled' | 'fulfilled' | 'shipped' | 'picked_up' | 'cancelled';
export type FulfillmentChannel = 'ship' | 'pickup';
export type ShipCarrier = 'usps' | 'ups' | 'fedex' | 'dhl' | 'other';
export type PaymentMethod = 'card' | 'cash' | 'check' | 'wire' | 'other';

export interface SOLine {
  id: string;
  description: string;
  partNumber?: string;
  qty: number;
  rate: number;
  dept?: DeptCode;
  pickedUpQty: number;
  shippedQty: number;
}

export interface Payment extends Stamp {
  id: string;
  method: PaymentMethod;
  amount: number;
  note?: string;
}

export interface Shipment extends Stamp {
  id: string;
  carrier: ShipCarrier;
  service: string;
  tracking: string;
  labelId: string;
  labelDataUrl: string;
  declaredValue: number;
  coverage: number;
  photos: PackagePhoto[];
  address: Address;
  bypassReason?: string;
}

export interface PickupSession extends Stamp {
  id: string;
  codeUsed?: string;
  proxyName?: string;
  proxyIdPhoto?: PackagePhoto;
  photos: PackagePhoto[];
  lineQty: Record<string, number>;
  bypassReason?: string;
  adminOverride?: boolean;
}

// One row per "Send invoice" — what the client was told at that moment (the link itself always shows the LIVE balance)
export interface InvoiceSend { at: string; by: string; total: number; balanceDue: number; emailId: string }
// Public mock hosted-payment page payload (Intuit placeholder)
export interface PayPage { order: SalesOrderWithRefs; paid: number; sends: InvoiceSend[]; merchant: string; mock: true }

export interface SalesOrder {
  id: string;
  number: string;
  clientId: string;
  jobId?: string;
  estimateId?: string;
  legacy?: LegacyMeta;
  convertedFromLegacy?: { id: string; number: string };
  status: SOStatus;
  channel?: FulfillmentChannel;
  orderDate: string;
  shipDate?: string;
  lines: SOLine[];
  shippingAmount: number;
  total: number;
  memo?: string;
  qboInvoiceId?: string;
  qboStatus: 'not_queued' | 'queued';
  payments: Payment[];
  balanceDue: number;
  isPaid: boolean;
  payLinkToken: string;
  invoiceSentAt?: string;
  invoiceSends: InvoiceSend[];
  pickupCode?: string;
  pickupCodeIssuedAt?: string;
  shippingAddress?: Address;
  shippingInfoRequestedAt?: string;
  tracking?: string;
  pickedUpAt?: string;
  pickupWindow?: PickupWindow;
  shipment?: Shipment;
  pickupSession?: PickupSession;
  fulfilledAt?: string;
  cancelledAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type SalesOrderWithRefs = SalesOrder & { client: Client; job: Job | null; watch: Watch | null };

export type TailStage = 'awaiting_invoice' | 'awaiting_payment' | 'ready_for_pickup' | 'ready_to_ship' | 'picked_up' | 'shipped';

// ---- E6 Workshop lenses + parts chat -------------------------------------------

export interface Part {
  id: string;
  partNumber: string;
  name: string;
  category: string;
  compatibleRefs: string[];
  calibers: string[];
  aliases: string[];
  price: number;
  stock: number;
  location?: string;
}

export type PartsRequestStatus = 'draft' | 'pending' | 'pending_review' | 'awaiting_client' | 'approved' | 'declined' | 'rejected' | 'on_order' | 'received';
// Pad v2 line item — price + part# filled by the manager at review; generic = free-typed, no part# yet
export interface PartsRequestItem { partId?: string; description: string; qty: number; price?: number; partNumber?: string; generic?: boolean }

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: { partId: string; reason: string }[];
  at: string;
}

export interface PartsRequest {
  id: string;
  number: string;
  jobId: string;
  status: PartsRequestStatus;
  partId?: string;
  qty: number;
  note?: string;
  searchTerms: string[];
  chat: ChatMessage[];
  requestedBy: string;
  requestedAt: string;
  station: string;
  decidedBy?: string;
  decidedAt?: string;
  items?: PartsRequestItem[];
  source?: 'chat' | 'wm' | 'pad';
  decisionNote?: string;
  reference?: string; caliber?: string; history?: { at: string; by: string; station: string; action: string }[];
  sentForApprovalAt?: string; sentBy?: string; clientDecidedAt?: string; allocatedAt?: string; emailId?: string;
}

// M3KE capture — append-only training-data plumbing (manager resolutions + supervisor selections)
export interface M3keEvent { id: string; kind: 'resolved' | 'selected'; description: string; reference: string; caliber?: string; partId: string; partNumber: string; price?: number; resolvedBy: string; ts: string; requestId?: string }
export interface PadSuggestion { part: Part; learned: boolean; source: 'learned' | 'ref' | 'caliber'; hint?: string }
export interface PadPartsContext { job: JobWithRefs; reference: string; caliber?: string; caliberParts: PadSuggestion[] }
export interface PadConditionView { source: 'report' | 'inspection' | 'none'; issuedBy?: string; issuedAt?: string; notes?: string; rows: { component: string; grade: string; note?: string }[] }

export interface PartsKnowledgeEntry extends Stamp {
  id: string;
  kind: 'association_confirmed' | 'alias_added' | 'rejected' | 'price_verified' | 'model_resolved';
  partId: string;
  partNumber: string;
  reference?: string;
  alias?: string;
  requestId: string;
  detail: string;
}

export type PartsRequestWithRefs = PartsRequest & { job: Job; part: Part | null; client: Client; watch: Watch };

export interface BenchView {
  jobs: (JobWithRefs & { nextAction: string | null; blocked: string | null })[];
  holds: JobWithRefs[];
  pullNext: JobWithRefs | null;
  partsRequests: PartsRequestWithRefs[];
}

export interface SupervisorBoard {
  unassigned: JobWithRefs[];
  byTech: { user: User; jobs: JobWithRefs[] }[];
  partsQueue: PartsRequestWithRefs[];
  holds: JobWithRefs[];
  qcQueue: JobWithRefs[];
}

export type FloorLane = 'intake' | 'review' | 'approval' | 'bench' | 'case_cleaning' | 'holds' | 'qc' | 'ready' | 'out';
export interface FloorMap { lanes: { key: FloorLane; label: string; jobs: JobWithRefs[] }[] }

// ---- E7 Client 360 ---------------------------------------------------------------

export type RequestSource = 'call' | 'email' | 'web' | 'walk_in' | 'kiosk';
export type RequestStatus = 'new' | 'quoted' | 'closed' | 'closed_by_client';
export type RequestCloseReason = 'duplicate' | 'no_longer_needed' | 'mistake';

export interface ServiceRequest {
  id: string;
  number: string;
  clientId: string;
  watchId?: string;
  source: RequestSource;
  status: RequestStatus;
  summary: string;
  estimateId?: string;
  createdAt: string;
  createdBy: string;
  station: string;
  closedAt?: string;
  closedNote?: string;
  closedBy?: 'staff' | 'client';
  closeReason?: RequestCloseReason;
  duplicateOfId?: string;
  division?: Division;
  kiosk?: KioskDetails;
}

export type IdentifierKind = 'client' | 'estimate' | 'job' | 'package' | 'sales_order' | 'watch' | 'request' | 'shipment';

// ---- Inbound shipping (pre-arrival) + tracking lookup -------------------------------------------------
export type ShipStage = 'label_requested' | 'label_sent' | 'in_transit' | 'delivered_unscanned' | 'arrived';
export type ShipCarrierName = 'UPS' | 'FedEx';
export interface TrackingEvent { at: string; status: string; location: string; note?: string }
export interface ShipStamp extends Stamp { action: string }
export interface InboundShipment {
  id: string; direction: 'inbound' | 'outbound'; estimateId: string; clientId: string; stage: ShipStage; carrier: ShipCarrierName; service: string;
  declaredValue: number; destinationState: string; requestedAt: string; labelSentAt?: string; trackingNumber?: string; labelUrl?: string; cost?: number;
  events: TrackingEvent[]; eta?: string; deliveredAt?: string; arrivedAt?: string; reissued?: boolean; stamps: ShipStamp[]; emailIds: string[];
}
export interface ShipmentWithRefs extends InboundShipment { estimate: Estimate; client: Client; watch?: Watch; ageDays: number; outstandingDays: number; lastEvent?: TrackingEvent; arrivingToday: boolean; unscannedHours: number }
export interface InboundCounts { label_requested: number; label_sent: number; in_transit: number; delivered_unscanned: number; red30: number; arrivingToday: number }
export interface ShipAddress { name: string; street: string; city: string; state: string; zip?: string }
export interface LabelPrep { shipment: ShipmentWithRefs; recipient: ShipAddress; validation: { valid: boolean; cleaned: ShipAddress; riskFlag?: string }; declaredValue: number }

export interface SearchHit {
  kind: IdentifierKind;
  id: string;
  hitKey: string;
  label: string;
  detail: string;
  matched: string;
  clientId?: string;
  clientName: string;
  path: string;
}

export interface SearchGroup { kind: IdentifierKind; label: string; hits: SearchHit[] }
export interface SearchResults { query: string; groups: SearchGroup[]; total: number }

export type CustodyKind = 'package_arrived' | 'watch_received' | 'discrepancy' | 'hold_placed' | 'hold_released' | 'shipped' | 'picked_up';

export interface CustodyEvent {
  id: string;
  kind: CustodyKind;
  at: string;
  by: string;
  station: string;
  detail: string;
  watchId?: string;
  jobId?: string;
  packageId?: string;
  salesOrderId?: string;
  hitKey: string;
  path: string;
}

export interface WatchHistoryRow {
  kind: 'estimate' | 'job' | 'sales_order' | 'request';
  legacy?: boolean;
  id: string;
  hitKey: string;
  number: string;
  status: string;
  title: string;
  amount?: number;
  at: string;
  path: string;
}

export interface WatchGroup {
  watch: Watch;
  history: WatchHistoryRow[];
  lifetimeSpend: number;
  lastServiceAt?: string;
  activeJobId?: string;
}

export interface ClientNoteRow extends Stamp {
  id: string;
  source: 'job' | 'estimate';
  ref: string;
  text: string;
  path: string;
}

export interface Client360Summary {
  watchCount: number;
  inHouse: number;
  openBalance: number;
  lifetimeSpend: number;
  openEstimates: number;
  activeJobs: number;
  openRequests: number;
  openTasks: number;
  lastContactAt?: string;
}

export interface Client360 {
  client: Client;
  summary: Client360Summary;
  watches: WatchGroup[];
  requests: ServiceRequest[];
  estimates: EstimateWithRefs[];
  jobs: JobWithRefs[];
  salesOrders: SalesOrderWithRefs[];
  payments: (Payment & { salesOrderId: string; salesOrderNumber: string })[];
  notes: ClientNoteRow[];
  tasks: Task[];
  custody: CustodyEvent[];
  emails: OutboxEmail[];
  packages: PackageWithRefs[];
}

export interface ClientDirectoryRow {
  client: Client;
  watchCount: number;
  inHouse: number;
  openEstimates: number;
  activeJobs: number;
  openBalance: number;
  lastActivityAt?: string;
}

// ---- E8 RolliConnect (client portal) ----------------------------------------------

export interface PickupWindow { date: string; slot: 'morning' | 'afternoon'; confirmedAt: string; note?: string }

export interface MagicLink { token: string; clientId: string; email: string; createdAt: string; usedAt?: string; next?: string; revokedAt?: string }
export interface PortalSession { clientId: string; email: string; token: string; issuedAt: string; viewAs?: { by: string; at: string; returnTo: string } }

// ---- Portal "Your requests" — one card per request across the lifecycle, so a multi-request client never wonders which watch a card is about ----
export type PortalRequestState = 'in_progress' | 'received' | 'decision' | 'stale_estimate' | 'history';
export interface PortalRequestCard { id: string; state: PortalRequestState; stateLabel: string; watchName: string; reference: string; title: string; blurb: string; lastUpdate: string; lastUpdateLabel: string; path: string; cta?: { label: string; path: string }; photoCount: number; requestNumber?: string; estimateNumber?: string; jobNumber?: string; amount?: number; split?: PortalSplit }
export interface PortalPhoto { id: string; url: string; label: string; at: string }
export interface PortalPhotoSections { arrival: PortalPhoto[]; condition: PortalPhoto[]; completed: PortalPhoto[]; jobNumber: string }

export interface Message {
  id: string;
  clientId: string;
  watchId?: string;
  from: 'client' | 'staff';
  by: string;
  text: string;
  at: string;
  readByStaff: boolean;
  readByClient: boolean;
  emailId?: string;
}

export type PortalStatusKey = 'on_file' | 'expecting' | 'awaiting_approval' | 'inspecting' | 'queued' | 'on_bench' | 'awaiting_part' | 'with_specialist' | 'final_checks' | 'finishing' | 'ready_pickup' | 'preparing_ship' | 'on_its_way' | 'back_with_you';
export interface PortalStatus { key: PortalStatusKey; label: string; blurb: string; active: boolean }

export type NeedsYouKind = 'approve_estimate' | 'pay_balance' | 'confirm_pickup' | 'shipping_info' | 'staff_reply' | 'review_inspection';
export interface NeedsYouItem { id: string; kind: NeedsYouKind; title: string; detail: string; path: string; at: string; watchId?: string }

export interface PortalDocument { id: string; kind: 'photo' | 'estimate' | 'invoice' | 'receipt' | 'label'; title: string; at: string; dataUrl?: string; path?: string; legacy?: boolean }

export interface PortalHistoryRow { id: string; at: string; title: string; detail: string; path?: string }

// Client-language split-flow strip — words first, no station names, no dot colours
export interface PortalSplitTrack { key: ComponentKey; label: string; done: boolean; text: string }
export interface PortalSplit { tracks: PortalSplitTrack[]; mergeLabel: string }

export interface PortalWatch {
  watch: Watch;
  split?: PortalSplit;
  jobIds: string[];
  status: PortalStatus;
  job?: Job;
  openEstimate?: Estimate;
  invoice?: SalesOrder;
  eta?: string;
  history: PortalHistoryRow[];
  documents: PortalDocument[];
  inspectionReportToken?: string;
}

export interface PortalRequest { request: ServiceRequest; statusLabel: string; canClose: boolean; watch?: Watch; duplicateOf?: ServiceRequest }
export interface PortalHome { client: Client; needsYou: NeedsYouItem[]; watches: PortalWatch[]; requests: PortalRequest[]; unreadMessages: number }

export interface StaffInboxThread { client: Client; messages: Message[]; unread: number; lastAt: string; watch?: Watch }


// ---- E9 RS modules: purchasing, inventory, templates, users admin, evidence ----------------------

export interface Vendor { id: string; name: string; contact: string; email: string; phone: string; terms: string; division: Division; active: boolean; notes?: string }

export type POStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
export interface POLine { id: string; partId: string; partNumber: string; description: string; qty: number; unitCost: number; receivedQty: number; requestId?: string; avgAtOrder?: number | null }
export interface PurchaseOrder {
  id: string; number: string; vendorId: string; status: POStatus; division: Division; locationId: string;
  lines: POLine[]; total: number; memo?: string; createdAt: string; createdBy: string; station: string;
  sentAt?: string; receivedAt?: string; cancelledAt?: string; cancelReason?: string;
  labelUrl?: string; trackingNumber?: string; labelService?: string; labelSource?: 'parcelpro' | 'upload'; redAcknowledgedBy?: string;
}
export type PurchaseOrderWithRefs = PurchaseOrder & { vendor: Vendor; location: StockLocation };
// ---- Inventory deep session: pricing intelligence, needs-ordering, reorder rules, PO labels, cycle-count queue + variance $ ----
export interface PurchaseHistoryRow { id: string; at: string; vendorId: string; partId: string; qty: number; unitPrice: number; poNumber?: string }
export interface PartPricing { partId: string; avgCost: number | null; last?: { price: number; at: string; vendorId: string; vendorName: string }; vendors: { vendorId: string; vendorName: string; lastPrice: number; lastAt: string; buys: number }[] }
export type PriceColor = 'green' | 'black' | 'red';
export interface ReorderRule { partId: string; min: number; orderUpTo: number }
export interface NeedsOrderingRow { id: string; partId: string; part: Part; reason: 'out_of_stock' | 'pick_short' | 'below_min'; qty: number; requestId?: string; jobNumber?: string; onHand: number; onOrder: number; at: string; vendorHint?: string }
export interface CountQueueRow { location: StockLocation; barcode: string; parts: number; lastCounted?: string; daysSince?: number; overdue: boolean }
export interface VarianceRow { countId: string; countNumber: string; at: string; by: string; location: string; partId: string; partNumber: string; expected: number; counted: number; qtyVariance: number; unitCost: number; dollarVariance: number }
export interface VarianceReport { rows: VarianceRow[]; totals: { qty: number; dollars: number; shrink: number; overage: number } }

export interface StockLocation { id: string; name: string; division: Division; kind: 'drawer' | 'cabinet' | 'safe' | 'bench' }
export interface StockLevel { partId: string; locationId: string; onHand: number; reorderPoint: number }
export type MovementKind = 'receipt' | 'adjustment' | 'count' | 'issue';
export interface StockMovement extends Stamp {
  id: string; kind: MovementKind; partId: string; locationId: string; delta: number; before: number; after: number;
  reason: string; ref?: string; poId?: string; jobId?: string; countId?: string; division: Division;
}
export interface CycleCountLine { partId: string; expected: number; counted?: number; skipped?: boolean; unitCost?: number }
export interface CycleCount extends Stamp { id: string; number: string; locationId: string; status: 'open' | 'posted'; lines: CycleCountLine[]; postedAt?: string; postedBy?: string; variances: number }
export interface StockRow { part: Part; location: StockLocation; onHand: number; reorderPoint: number; low: boolean }

export type TemplateKey = 'intake_confirmation' | 'estimate_sent' | 'job_in_progress' | 'back_in_progress' | 'ready_for_pickup' | 'shipped' | 'inspection_ready' | 'invoice_ready' | 'evidence_available' | 'shipping_dispute';
export interface MessageTemplate extends Stamp { key: TemplateKey; name: string; subject: string; body: string; mergeFields: string[]; updatedBy: string }

export interface UserAdminInput { firstName: string; shortName: string; dutyLabel: string; accessTier: AccessTier; roles: Role[]; division: Division | 'both'; password: string; pin: string }

export type EvidenceSlot = 'hidden_serial' | 'timing_sheet' | 'pressure_test' | 'parts_grading';
export type PartsGrade = 'B' | 'Ø/REPL' | 'D/REPL';
export interface EvidenceItem extends Stamp {
  id: string; jobId: string; watchId: string; slot: EvidenceSlot; photo: PackagePhoto; labelScan: string;
  grades?: PartsGrade[]; depthRating?: string; note?: string; extracted?: unknown;
}
export interface ReportRow { label: string; values: Record<string, number | string> }
export interface Report { key: string; title: string; columns: string[]; rows: ReportRow[]; note: string; generatedAt: string }
export interface QboQueueRow { salesOrderId: string; number: string; client: string; total: number; qboInvoiceId?: string; syncState: 'not_queued' | 'queued' | 'pushed_stub' | 'error_stub'; at: string }
export interface IntegrationTile { key: 'qbo' | 'shipping' | 'rollitime' | 'email'; name: string; health: 'not_connected' | 'stub'; blurb: string; lastCheck: string }

// ---- E10 Companion panel (scripted assistant) ------------------------------------------------------
export interface ModelReference { id: string; model: string; aliases: string[]; yearFrom: number; yearTo: number; reference: string; brand: 'Rolex' | 'Tudor' }
export interface PriceEvidence { partId: string; uses: number; avg: number; last: string }
export interface PriceCandidate { part: Part; uses: number; avg: number; last: string; verified?: Stamp; stale: boolean; fits: boolean }
export interface PriceMemoryAnswer { query: string; resolution: { reference?: string; model?: string; via: 'reference' | 'alias' | 'year' | 'none'; clarify?: string }; candidates: PriceCandidate[]; text: string }
export type BriefLineKey = 'relationship' | 'history' | 'service_debt';
export interface BriefCitation { label: string; hitKey: string }
export interface BriefLine { key: BriefLineKey; text: string; citations: BriefCitation[]; corrected?: BriefCorrection; moneyMasked?: boolean }
export interface BriefCorrection extends Stamp { id: string; clientId: string; key: BriefLineKey; text: string; original: string }
export interface ClientBrief { clientId: string; lines: BriefLine[]; debt?: { jobNumber: string; daysLate: number; jobId: string }; generatedAt: string }
export interface KnowledgeCard extends Stamp { id: string; title: string; body: string; tags: string[]; sourceTaskId?: string; askedBy?: string }
export interface RoutedQuestion extends Stamp { id: string; question: string; taskId: string; status: 'open' | 'answered'; cardId?: string; division: Division }
export interface AskAnswer { query: string; card?: KnowledgeCard; score: number; text: string; routed?: RoutedQuestion }
export type LabelPillGroup = 'dial' | 'hands' | 'bracelet' | 'condition';
export interface PhotoLabel extends Stamp { id: string; photoId: string; jobId: string; watchId: string; source: 'inspection' | 'evidence'; tags: string[]; skipped: boolean }

// ---- E14 Comms hub -----------------------------------------------------------------------------------
export type ConversationStatus = 'open' | 'snoozed' | 'closed';
export interface ConversationAnchor { kind: 'request' | 'estimate' | 'job'; id: string }
export interface Conversation {
  id: string; clientId: string; subject: string; anchor?: ConversationAnchor; status: ConversationStatus; assignedTo?: Assignee; division: Division;
  createdAt: string; lastAt: string; lastInboundAt?: string; lastOutboundAt?: string; snoozedUntil?: string; snoozedBy?: string; closedAt?: string; closedBy?: string; tokenSeq: number;
}
export type MessageSource = 'portal' | 'email' | 'kiosk' | 'approval' | 'photo' | 'parts' | 'pickup' | 'staff' | 'note' | 'system';
export interface ConvMessage {
  id: string; conversationId: string; clientId: string; direction: 'in' | 'out' | 'internal'; source: MessageSource; by: string; station?: string; text: string; at: string;
  token?: string; matchedToken?: string; readByStaff: boolean; photos?: PackagePhoto[]; emailId?: string; templateKey?: TemplateKey;
  event?: { kind: 'estimate_approved' | 'estimate_declined' | 'parts_approved' | 'parts_rejected' | 'pickup_window' | 'photo_submitted'; refId: string; label: string };
}
export type InboxView = 'needs_reply' | 'mine' | 'open' | 'snoozed' | 'closed';
export interface ConversationWithRefs extends Conversation { client: Client; anchorLabel?: string; anchorPath?: string; unread: number; needsReply: boolean; ageHours: number; last?: ConvMessage; assigneeLabel?: string; linkedEstimate?: { id: string; number: string; status: string } }
export interface ThreadView { conversation: ConversationWithRefs; messages: ConvMessage[]; folder: ConversationWithRefs[] }
export interface RenderedTemplate { key: TemplateKey; subject: string; body: string; missing: string[]; source: 'shop' | 'personal'; owner?: string }
// A staff member's own version of a shop template — used automatically for THEIR point-of-use sends; system/automated sends always use the shop default
export interface PersonalTemplate { key: TemplateKey; owner: string; subject: string; body: string; updatedAt: string }

// ---- E15 Portal-first inspection report (MH 2026-09-25) --------------------------------------------
export type ComponentGrade = 'good' | 'fair' | 'worn' | 'replace';
export interface InspectionReportDoc {
  id: string; token: string; version: number; jobId: string; watchId: string; clientId: string; estimateId?: string;
  status: 'issued' | 'approved' | 'declined' | 'superseded'; supersededById?: string; supersedes?: string;
  grades: { component: string; grade: ComponentGrade; note?: string }[]; notes: string; photoIds: string[];
  issuedAt: string; issuedBy: string; station: string; emailId?: string; decidedAt?: string; decidedVia?: 'portal' | 'staff'; declineReason?: string;
}
export interface PortalInspectionReport { report: InspectionReportDoc; watch: Watch; client: Client; job: Job; estimate?: Estimate; photos: PackagePhoto[]; newerToken?: string; decision?: InspectionDecisionRecord }
// The client's permanent decision record — what they approved/declined/chose/signed and when; visible in Watch Records and on the job
export type PolishChoice = 'none' | 'light' | 'full';
export interface InspectionDecisionRecord { id: string; reportId: string; reportVersion: number; jobId: string; jobNumber: string; watchId: string; clientId: string; decision: 'approve' | 'decline'; reason?: string; polish: PolishChoice; survey: { q: string; a: string }[]; signature: string; decidedAt: string; via: 'portal' | 'staff' }
export interface DecisionInput { polish: PolishChoice; survey: { q: string; a: string }[]; signature: string; reason?: string }

// ---- E12 RolliTime timing bench -----------------------------------------------------------------------
export type TimingPosition = 'DU' | 'DD' | 'CD' | 'CL' | 'CU' | 'CR';
export interface CaliberTolerance { caliber: string; label: string; refPrefixes: string[]; crit1MaxDelta: number; crit2Min: number; crit2Max: number; beatMax: number; ampMin: number; ampMax: number; reserveHours: number; liftAngle: number }
export interface TimingReading { position: TimingPosition; rate: number; beat: number; amp: number }
export interface TimingEvaluation { crit1: boolean; crit2: boolean; beat: boolean; amp: boolean; reserve: boolean; suggested: 'pass' | 'reject'; flags: string[] }
export interface TimingTest extends Stamp {
  id: string; jobId: string; watchId: string; jobNumber: string; caliber: string; readings: TimingReading[]; avgRate: number; avgBeat: number; avgAmp: number; delta: number; liftAngle: number; powerReserve: number;
  evaluation: TimingEvaluation; verdict: 'pass' | 'reject'; reason?: string; emailId?: string;
}
export interface TimingInput { readings: TimingReading[]; liftAngle: number; powerReserve: number; verdict: 'pass' | 'reject'; reason?: string }

// ---- E13 RGTime `/rg` (NFC tap time-clock, phone PWA) + public Kiosk `/kiosk` --------------------
export interface NfcTag { id: string; label: string; division: Division; url: string }
export type PunchKind = 'in' | 'out';
export type PunchFlag = 'offsite' | 'no_gps' | 'synced_late' | 'kiosk' | 'correction';
export type PunchSource = 'nfc' | 'kiosk' | 'manager' | 'seed';
export interface Punch {
  id: string; userId: string; kind: PunchKind; at: string; tagId: string; location: string; division: Division; simulated: boolean;
  source?: PunchSource; flags?: PunchFlag[]; geo?: { lat: number; lng: number; distanceM: number } | null; recordedAt?: string;
  correctionOf?: string; reason?: string; by?: string; queued?: boolean;
}
export interface ClockState { user: User; onClock: boolean; since?: string; sinceLocation?: string; todayPunches: Punch[]; todayHours: number }
export interface WeekDay { date: string; hours: number; punches: Punch[]; open: boolean; flagged: boolean }
export interface WeekRow { user: User; days: WeekDay[]; total: number; openNow: boolean }
export interface WeekView { start: string; end: string; division: Division | 'all'; rows: WeekRow[]; weekOffset: number }
export interface RgSettings { shopLat: number; shopLng: number; radiusM: number; simulateOffsite: boolean; simulateOffline: boolean }
export type RgFlagKind = 'offsite' | 'synced_late' | 'missed_out' | 'correction' | 'no_gps';
export interface RgFlagRow { punch: Punch; user: User; kind: RgFlagKind; original?: Punch }

export type KioskService = 'mov_service' | 'case_work' | 'band_repair' | 'band_polish' | 'recut_bezel';
export type KioskMatchState = 'none' | 'possible' | 'confirmed' | 'split';
export interface KioskDetails { firstName: string; lastName: string; email: string; phone: string; services: KioskService[]; notes?: string; matchState: KioskMatchState; matchedClientId?: string; matchedOn?: ('email' | 'phone')[] }
export interface KioskSubmission { brand: Division; services: KioskService[]; firstName: string; lastName: string; email: string; phone: string; notes?: string }
export interface KioskResult { request: ServiceRequest; client: Client; possibleExisting: boolean }
export interface RequestRow extends ServiceRequest { client: Client; watch?: Watch }

// ---- E11 RolliWorking `/rw` — legacy two-lane floor (head lane / band lane → Final assembly; Into safe off-ramp) — PROVISIONAL vs the 9-lane RS map
export type RwStageKey = 'intake' | 'review' | 'bench' | 'polish';
export interface RwStage { key: RwStageKey; label: string; jobs: JobWithRefs[] }
export interface RwFloorMap { division: Division; head: RwStage[]; band: RwStage[]; finalAssembly: JobWithRefs[]; intoSafe: { key: 'components' | 'hold' | 'approval' | 'ready'; label: string; jobs: JobWithRefs[] }[] }

// ---- E18 RW deep build — shop floor core ----------------------------------------------------------------
export type RwLane = 'head' | 'band' | 'shared';
export type RwStationKey = 'pre_approval' | 'pre_queue' | 'wm_bench_1' | 'wm_bench_2' | 'wm_bench_3' | 'into_safe_head' | 'safe_await_band' | 'band_pre_queue' | 'refinish' | 'polish' | 'into_safe_band' | 'safe_await_head' | 'final_assembly' | 'testing' | 'finished';
export interface RwStation { key: RwStationKey; label: string; lane: RwLane; order: number }
export type PartColorKey = 'head' | 'case' | 'band';
export interface FloorDot { jobId: string; jobNumber: string; key: ComponentKey; label: string; station: RwStationKey; partStatus: PartStatus; tech?: string; kind: JobKind; priority: JobPriority; watchLabel: string; completed?: { by: string; undoToken: string; transitioned: boolean } }
export interface ShopFloor { stations: RwStation[]; dots: FloorDot[]; counts: Record<RwStationKey, number>; techs: string[] }
export interface PartHistoryView { job: JobWithRefs; part: JobComponent; moves: PartMove[] }
export interface ScanSession { tech?: User; rows: { at: string; jobNumber: string; jobId: string; watchLabel: string; part: string; outboxId?: string }[] }
export interface WorkQueueRow { job: JobWithRefs; overdue: boolean; clientReplied: boolean; parts: { key: ComponentKey; done: boolean; station?: RwStationKey }[] }
export interface PickTask { id: string; prId: string; partId: string; jobId: string; qty: number; status: 'open' | 'picked' | 'short' | 'found'; location: string; createdAt: string; doneAt?: string; note?: string }
export interface PickTaskView extends PickTask { part: Part; job: JobWithRefs; onHand: number }
export interface PartSuggestion { part: Part; score: number; reason: 'recent' | 'name' | 'alias' | 'ref' }
export type SendBackReason = 'rework' | 'waiting_on_part' | 'failed_qc' | 'other';
export interface PadCard { job: JobWithRefs; stage: JobStatus; stageLabel: string; canAdvance: boolean; canSendBack: boolean; parts: FloorDot[]; photos: number; pendingParts: number }
export interface RoomSummary { jobsInRoom: number; waitingOnParts: number; waitingOnApproval: number; picksRemaining: number; shortsToday: number }
export interface JobPhotoView { id: string; url: string; slot: string; kind: 'intake' | 'inspection' | 'completed'; at: string; by: string }

// ---- Job messages — threaded, internal-only board ON the job; @mentions route by tier (hit list vs bench Messages) ----
export interface JobMessage extends Stamp { id: string; jobId: string; parentId?: string; text: string; mentions: string[]; notify: string[]; photo?: PackagePhoto; readBy: string[] }
export interface JobThread { root: JobMessage; replies: JobMessage[]; participants: string[] }
export interface MessageInboxRow { thread: JobThread; latest: JobMessage; job: JobWithRefs; unread: boolean }

// ---- Bench Pad `/rw/bench` — one kiosked iPad per watchmaker bench (device = station, PIN = person) ----
export interface BenchJobRow { job: JobWithRefs; parts: FloorDot[]; idleDays: number; late: boolean; stuck: boolean }
export type SplitState = 'split' | 'waiting_band' | 'waiting_head' | 'reunited';
export interface BenchSplitRow { job: JobWithRefs; parts: FloorDot[]; state: SplitState; bandDoneBy?: string; bandDoneAt?: string }
export interface BenchOutsourceRow { job: JobWithRefs; vendor: string; reason: string; daysOut: number }
export interface GoalMonth { key: string; label: string; goal: number; actual: number; hit: boolean; byWeek: { label: string; count: number }[]; byType: Record<ComponentKey, number>; quality?: TechQuality }
export interface BenchGoals { current: GoalMonth; paceTarget: number; dayOfMonth: number; daysInMonth: number; history: GoalMonth[] }
export interface BenchBoard { user: User; inProgress: BenchJobRow[]; attention: BenchJobRow[]; splits: BenchSplitRow[]; outsourced: BenchOutsourceRow[]; completed: { job: JobWithRefs; part: FloorDot; at: string }[]; goals: BenchGoals; messages: MessageInboxRow[]; unread: number; stuckDays: number }
export interface BenchSettings { benchName: string; idleMinutes: number; simulateOffline: boolean }

// ---- Stage / bin audit (Station Scanner + Supervisor Pad) — append-only sessions ----------------------------------------
export type AuditBinKey = 'orphan_bin' | 'awaiting_payment_bin' | 'pre_intake_bin';
export type AuditLocationKey = RwStationKey | AuditBinKey;
export interface AuditLocation { key: AuditLocationKey; label: string; group: 'station' | 'bin'; lane?: RwLane }
export type ValueTier = 'high' | 'mid' | 'standard';
export interface AuditItem { id: string; jobId: string; jobNumber: string; key: ComponentKey; partLabel: string; watchLabel: string; reference: string; serial: string; clientId: string; clientName: string; tier: ValueTier; lastCustody?: { by: string; at: string; where: string } }
export type AuditResolution = 'corrected' | 'investigate';
export interface AuditUnexpected extends AuditItem { believedAt: AuditLocationKey; believedLabel: string; resolution?: AuditResolution }
export type AuditScanResult = 'matched' | 'unexpected' | 'duplicate' | 'unknown';
export interface AuditLive { location: AuditLocation; startedAt: string; expected: AuditItem[]; matched: string[]; unexpected: AuditUnexpected[]; scans: { code: string; at: string; result: AuditScanResult; label: string }[] }
export interface AuditSession { id: string; location: AuditLocationKey; locationLabel: string; by: string; station: string; startedAt: string; finishedAt: string; expectedCount: number; matched: number; missing: AuditItem[]; unexpected: AuditUnexpected[]; pinId?: string }
export interface AuditLocationStatus { location: AuditLocation; expected: number; lastAudited?: string; lastResult?: 'clean' | 'missing'; stale: boolean; daysSince?: number }

// ---- Work grading gate at /rw/testing — Setup lookup categories, 1–5 scores, append-only grade events attributed to job + responsible tech --------
export type GradeScope = 'head' | 'case' | 'bracelet' | 'whole';
export interface GradeCategory { id: string; key: string; label: string; hint: string; scopes: GradeScope[]; active: boolean; createdBy: string; createdAt: string }
export type GradeScore = 1 | 2 | 3 | 4 | 5;
export interface WorkGrade { id: string; jobId: string; jobNumber: string; categoryId: string; categoryLabel: string; score: GradeScore; note?: string; photoUrl?: string; tech: string; techAuto: string; grader: string; selfGraded: boolean; at: string; station: string }
export interface GradeGateRow { category: GradeCategory; grade?: WorkGrade; suggestedTech: string; techOptions: string[] }
export interface GradeGate { rows: GradeGateRow[]; missing: string[]; ready: boolean }
export interface TechQuality { n: number; avg: number | null; byCategory: Record<string, { label: string; avg: number; n: number }>; low: number; selfGraded: number }

// ---- Client rating (STRICTLY internal — never /rc, never view-as-client, never emails/exports) ----------------------------------------
export type Star = 1 | 2 | 3 | 4 | 5;
export interface RatingChange { at: string; by: string; station: string; field: 'attitude' | 'communication'; from?: Star; to: Star }
export interface ClientRating { clientId: string; attitude?: Star; communication?: Star; completed: number; badge: string; tooltip: string; history: RatingChange[] }
// ---- Telephony seam (mock of Vonage VIP) — src/api/telephony.ts adapts inbound events into screen-pops + comms history ----------------
export interface InboundCallEvent { number: string; at: string; direction: 'inbound'; answered?: boolean; voicemail?: boolean }
export type ScreenPop = { kind: 'known'; client: Client; rating: ClientRating; inService: number; needsReply: number; callId: string } | { kind: 'unknown'; number: string; callId: string } | { kind: 'missed'; client?: Client; number: string; callId: string };
export type CallOutcome = 'answered' | 'missed' | 'voicemail' | 'manual';
export interface CallNote { at: string; by: string; text: string }
export interface CallEvent { id: string; at: string; direction: 'in' | 'out'; number: string; clientId?: string; answeredBy?: string; station: string; outcome: CallOutcome; durationSec?: number; jobId?: string; notes: CallNote[]; afterHours: boolean; resolvedAt?: string; resolvedBy?: string; resolution?: 'called_back' | 'handled' }
export interface CallCounts { total: number; thisMonth: number; missed: number; openMissed: number }
export interface MissedCallRow { call: CallEvent; client?: Client; badge?: string }

// ---- Shipping bill audit (AI-assisted reconciliation of the carrier / Parcel Pro invoice against our label ledger) ----
export interface BillSurcharge { kind: string; amount: number }
export interface BillLine { id: string; trackingNumber: string; shipDate: string; service: string; billed: number; surcharges: BillSurcharge[]; declaredValue: number | null; carrier?: string }
export type BillBucket = 'voided_billed' | 'unknown' | 'variance' | 'matched' | 'unbilled';
export interface LedgerLabel { trackingNumber: string; ref: string; kind: 'inbound' | 'outbound' | 'po'; carrier: string; service: string; cost: number; createdAt: string; voided: boolean; voidedAt?: string; who?: string; path: string }
export interface BillDecision { action: 'accept' | 'dispute'; reason: string; by: string; at: string }
export interface BillAuditLine { id: string; bucket: BillBucket; bill?: BillLine; label?: LedgerLabel; delta: number; decision?: BillDecision }
export interface BillAuditTotals { billed: number; matchedClean: number; variance: number; disputed: number; recovered: number; lines: number }
export interface BillAuditEvent { at: string; by: string; text: string }
export interface BillAudit { id: string; number: string; vendor: string; fileName: string; uploadedAt: string; by: string; station: string; lines: BillAuditLine[]; totals: BillAuditTotals; disputeEmailId?: string; disputeSentAt?: string; recoveredAt?: string; events: BillAuditEvent[] }

// ---- Supervisor department dashboard + parts quick-add / returns ----
export type PaceStatus = 'ahead' | 'on_pace' | 'behind';
export interface DeptGoalMonth { key: string; label: string; goal: number; actual: number; hit: boolean; current?: boolean }
export interface DeptGoals { goal: number; actualMtd: number; projected: number; pace: PaceStatus; dayOfMonth: number; daysInMonth: number; history: DeptGoalMonth[] }
export interface TechPace { user: User; goal: number; actual: number; paceTarget: number; pace: PaceStatus; activeJobs: number; testingJobs: number; cards: PadCard[] }
export interface DeptDashboard { department: 'wm' | 'band'; label: string; goals: DeptGoals; techs: TechPace[]; funnel: { stage: JobStatus; label: string; count: number }[]; totalJobs: number; stuck: PadCard[]; problem: PadCard[]; awaitingParts: PadCard[]; testing: PadCard[]; stuckDays: number }
export interface JobPart { id: string; jobId: string; partId: string; partNumber: string; name: string; price: number; qty: number; addedBy: string; at: string; via: 'quick_add' | 'request' }
export interface PartsReturn { id: string; jobId: string; partId: string; partNumber: string; qty: number; note?: string; by: string; at: string }
export interface JobPartsView { allowance: number; used: number; remaining: number; parts: JobPart[]; returns: PartsReturn[] }
export interface QuickAddResult { kind: 'added' | 'routed_to_approval'; part: Part; view: JobPartsView; requestNumber?: string }

// ---- Component code chips + trickle-down verification chain (Expected → Received → Verified) ----
export type ChainState = 'ok' | 'missing' | 'extra' | 'pending';
export interface ChainRow { component: string; expected: boolean; received?: boolean; verified?: boolean; state: ChainState }
export interface VerificationChain { estimateId: string; estimateNumber: string; codes: DeptCode[]; inferred: boolean; rows: ChainRow[]; received?: { at: string; by: string; packageId: string; subNumber: string }; verified?: { at: string; by: string }; complete: boolean; discrepancies: number }

// ---- Per-staff client reviews (STRICTLY internal) — one review per staff member per client, latest wins, history kept ----
export interface StaffReview { id: string; clientId: string; by: string; attitude: Star; communication: Star; jobsHandled: number; note?: string; at: string; station: string }
export interface ClientReviews { clientId: string; aggregate: ClientRating; reviews: StaffReview[]; mine?: StaffReview }

// ---- QuickBooks Online setup (MOCKED — no OAuth, no network) ----
export type QboSyncState = 'synced' | 'pending' | 'conflict' | 'not_linked';
export interface QboMapping { rolli: string; qbo: string; direction: 'push' | 'pull' | 'both' }
export interface QboClientRow { client: Client; qboCustomerId?: string; state: QboSyncState; lastSync?: string; issue?: string }
export interface QboSetup { connected: boolean; company?: string; realmId?: string; connectedBy?: string; connectedAt?: string; lastSync?: string; toggles: { pushInvoices: boolean; pushPayments: boolean; pushClients: boolean; pullPayments: boolean }; mapping: QboMapping[]; clients: QboClientRow[]; queue: QboQueueRow[]; log: { at: string; by: string; text: string }[] }

// ---- No-estimate receiving branch — three-tier B2B label match chain ----
export type B2bTier = 'tracking' | 'account_code' | 'name' | 'none';
export interface B2bMatch { code: string; tier: B2bTier; estimate?: EstimateWithRefs; client?: Client; candidates: Client[]; subNumber: string; explain: string }

// ---- Station intercom + storewide paging (mock state; Daily.co seam) ----
export type IntercomKind = 'station' | 'room' | 'pad';
export interface IntercomStation { id: string; label: string; kind: IntercomKind; division: Division; online: boolean; busy: boolean }
export interface IntercomCall { id: string; from: string; to: string; startedAt: string; state: 'ringing' | 'live' | 'ended'; endedAt?: string }
export interface StorePage { id: string; by: string; from: string; text: string; at: string; division: Division | 'all' }
export interface IntercomState { me: string; stations: IntercomStation[]; call?: IntercomCall; pages: StorePage[]; history: IntercomCall[] }
