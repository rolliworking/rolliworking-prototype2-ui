import type { CycleCount, EvidenceItem, IntegrationTile, MessageTemplate, PurchaseOrder, StockLevel, StockLocation, StockMovement, Vendor } from '../types';
import { seedPhoto } from './intake';
import { daysAgo } from './time';

export const vendors: Vendor[] = [
  { id: 'v-rsc', name: 'Rolex Service Center (RSC)', contact: 'Parts desk', email: 'parts@rsc.example.com', phone: '(212) 555-0140', terms: 'Net 30', division: 'rolliworks', active: true },
  { id: 'v-tudor', name: 'Tudor Parts Distribution', contact: 'Aline Perret', email: 'orders@tudor-parts.example.com', phone: '(212) 555-0141', terms: 'Net 30', division: 'rolliworks', active: true },
  { id: 'v-gold', name: 'Goldsmith & Co. Plating', contact: 'Ruben Katz', email: 'ruben@goldsmithco.example.com', phone: '(718) 555-0142', terms: 'Due on receipt', division: 'rolliworks', active: true, notes: 'Outsource vendor for PM bezel work' },
  { id: 'v-ap', name: 'AP Boutique Supply', contact: 'Trade desk', email: 'trade@ap-supply.example.com', phone: '(646) 555-0143', terms: 'Prepaid', division: 'rollishop', active: true },
  { id: 'v-old', name: 'Crystal Source Ltd (retired)', contact: '—', email: 'sales@crystalsource.example.com', phone: '(800) 555-0144', terms: 'Net 15', division: 'rolliworks', active: false },
];

export const locations: StockLocation[] = [
  { id: 'loc-a1', name: 'Parts drawer A1', division: 'rolliworks', kind: 'drawer' },
  { id: 'loc-a2', name: 'Parts drawer A2', division: 'rolliworks', kind: 'drawer' },
  { id: 'loc-safe', name: 'PM safe', division: 'rolliworks', kind: 'safe' },
  { id: 'loc-b1', name: 'Bench 1 tray', division: 'rolliworks', kind: 'bench' },
  { id: 'loc-rs', name: 'RS Counter cabinet', division: 'rollishop', kind: 'cabinet' },
];

// on-hand per part per location; parts not listed have no stock row (stock lives here, not on Part.stock)
export const stockLevels: StockLevel[] = [
  { partId: 'pt-01', locationId: 'loc-a1', onHand: 4, reorderPoint: 3 },
  { partId: 'pt-02', locationId: 'loc-a1', onHand: 1, reorderPoint: 2 },
  { partId: 'pt-03', locationId: 'loc-a1', onHand: 0, reorderPoint: 2 },
  { partId: 'pt-04', locationId: 'loc-a2', onHand: 6, reorderPoint: 4 },
  { partId: 'pt-05', locationId: 'loc-a2', onHand: 2, reorderPoint: 2 },
  { partId: 'pt-06', locationId: 'loc-a2', onHand: 12, reorderPoint: 5 },
  { partId: 'pt-07', locationId: 'loc-b1', onHand: 1, reorderPoint: 1 },
  { partId: 'pt-08', locationId: 'loc-a1', onHand: 3, reorderPoint: 2 },
  { partId: 'pt-09', locationId: 'loc-a2', onHand: 0, reorderPoint: 1 },
  { partId: 'pt-10', locationId: 'loc-safe', onHand: 2, reorderPoint: 1 },
  { partId: 'pt-11', locationId: 'loc-a1', onHand: 8, reorderPoint: 4 },
  { partId: 'pt-12', locationId: 'loc-a2', onHand: 5, reorderPoint: 3 },
  { partId: 'pt-13', locationId: 'loc-rs', onHand: 2, reorderPoint: 1 },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: 'po-01', number: 'PO-26-0021', vendorId: 'v-rsc', status: 'received', division: 'rolliworks', locationId: 'loc-a1', lines: [{ id: 'pol-01', partId: 'pt-01', partNumber: '', description: '', qty: 2, unitCost: 48, receivedQty: 2 }], total: 96, createdAt: daysAgo(14, 10), createdBy: 'MM', station: 'Watchmaker Room', sentAt: daysAgo(14, 11), receivedAt: daysAgo(9, 15), memo: 'Restock crystals' },
  { id: 'po-02', number: 'PO-26-0022', vendorId: 'v-rsc', status: 'sent', division: 'rolliworks', locationId: 'loc-a1', lines: [{ id: 'pol-02', partId: 'pt-03', partNumber: '', description: '', qty: 2, unitCost: 210, receivedQty: 0 }, { id: 'pol-03', partId: 'pt-02', partNumber: '', description: '', qty: 2, unitCost: 65, receivedQty: 0 }], total: 550, createdAt: daysAgo(6, 9), createdBy: 'MM', station: 'Watchmaker Room', sentAt: daysAgo(6, 9), memo: 'cal. 3285 barrel for E02014 (PR-0041) + crown backfill' },
  { id: 'po-03', number: 'PO-26-0023', vendorId: 'v-tudor', status: 'partially_received', division: 'rolliworks', locationId: 'loc-a2', lines: [{ id: 'pol-04', partId: 'pt-09', partNumber: '', description: '', qty: 3, unitCost: 32, receivedQty: 1 }], total: 96, createdAt: daysAgo(4, 10), createdBy: 'Walter', station: 'Front Desk 1', sentAt: daysAgo(4, 10) },
  { id: 'po-04', number: 'PO-26-0024', vendorId: 'v-gold', status: 'draft', division: 'rolliworks', locationId: 'loc-safe', lines: [{ id: 'pol-05', partId: 'pt-10', partNumber: '', description: '', qty: 1, unitCost: 390, receivedQty: 0 }], total: 390, createdAt: daysAgo(1, 9), createdBy: 'MM', station: 'Watchmaker Room' },
  { id: 'po-05', number: 'PO-26-0025', vendorId: 'v-ap', status: 'sent', division: 'rollishop', locationId: 'loc-rs', lines: [{ id: 'pol-06', partId: 'pt-13', partNumber: '', description: '', qty: 4, unitCost: 22, receivedQty: 0 }], total: 88, createdAt: daysAgo(1, 11), createdBy: 'Walter', station: 'RS Counter', sentAt: daysAgo(1, 11), memo: 'Royal Oak bezel screws' },
];

export const stockMovements: StockMovement[] = [
  { id: 'mv-01', kind: 'receipt', partId: 'pt-01', locationId: 'loc-a1', delta: 2, before: 2, after: 4, reason: 'Received against PO-26-0021', ref: 'PO-26-0021', poId: 'po-01', division: 'rolliworks', at: daysAgo(9, 15), by: 'MM', station: 'Watchmaker Room' },
  { id: 'mv-02', kind: 'issue', partId: 'pt-04', locationId: 'loc-a2', delta: -1, before: 7, after: 6, reason: 'Fitted on E02011', ref: 'E02011', jobId: 'j-01', division: 'rolliworks', at: daysAgo(3, 12), by: 'MM', station: 'Bench 1' },
  { id: 'mv-03', kind: 'adjustment', partId: 'pt-07', locationId: 'loc-b1', delta: -1, before: 2, after: 1, reason: 'Damaged during fitting — scrapped', division: 'rolliworks', at: daysAgo(2, 16), by: 'MM', station: 'Bench 1' },
  { id: 'mv-04', kind: 'receipt', partId: 'pt-09', locationId: 'loc-a2', delta: 1, before: -1, after: 0, reason: 'Partial receipt against PO-26-0023 (1 of 3)', ref: 'PO-26-0023', poId: 'po-03', division: 'rolliworks', at: daysAgo(1, 14), by: 'Walter', station: 'Front Desk 1' },
  { id: 'mv-05', kind: 'count', partId: 'pt-11', locationId: 'loc-a1', delta: 1, before: 7, after: 8, reason: 'Cycle count CC-26-0003 variance +1', ref: 'CC-26-0003', countId: 'cc-01', division: 'rolliworks', at: daysAgo(7, 17), by: 'MM', station: 'Watchmaker Room' },
];

export const cycleCounts: CycleCount[] = [
  { id: 'cc-01', number: 'CC-26-0003', locationId: 'loc-a1', status: 'posted', lines: [{ partId: 'pt-01', expected: 4, counted: 4 }, { partId: 'pt-11', expected: 7, counted: 8 }], variances: 1, at: daysAgo(7, 16), by: 'MM', station: 'Watchmaker Room', postedAt: daysAgo(7, 17), postedBy: 'MM' },
];

export const MERGE_FIELDS = ['{{portal.link}}', '{{client.first_name}}', '{{watch.brand}}', '{{watch.model}}', '{{estimate.number}}', '{{job.number}}', '{{sub.number}}', '{{so.number}}', '{{pickup.code}}', '{{tracking}}', '{{balance_due}}', '{{shop.name}}'];
const tpl = (key: MessageTemplate['key'], name: string, subject: string, body: string): MessageTemplate => ({ key, name, subject, body, mergeFields: MERGE_FIELDS.filter((f) => body.includes(f) || subject.includes(f)), at: daysAgo(30, 9), by: 'MH', station: 'Front Desk 1', updatedBy: 'MH' });
export const templates: MessageTemplate[] = [
  tpl('intake_confirmation', 'Intake confirmation', 'We’ve received your {{watch.brand}} {{watch.model}}', 'Hello {{client.first_name}},\n\nYour package arrived safely at {{shop.name}} (Sub# {{sub.number}}). Follow its progress here:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('estimate_sent', 'Estimate ready', 'Your estimate {{estimate.number}} is ready to review', 'Hello {{client.first_name}},\n\nYour estimate {{estimate.number}} for the {{watch.brand}} {{watch.model}} is ready. Review and approve it here:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('inspection_ready', 'Inspection report ready', 'Your inspection report is ready — {{watch.model}}', 'Hello {{client.first_name}},\n\nWe have finished inspecting your {{watch.brand}} {{watch.model}}. Condition grades, photos and our notes are on your report page, where you can approve or decline:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('job_in_progress', 'Job in progress', 'Work has started on your {{watch.model}}', 'Hello {{client.first_name}},\n\nA watchmaker has opened the case on your {{watch.brand}} {{watch.model}} ({{job.number}}). Progress lives here:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('back_in_progress', 'Back to in progress (after QC)', 'A short delay on your {{watch.model}}', 'Hello {{client.first_name}},\n\nFinal testing found something we want to correct before your {{watch.model}} leaves the shop. Details are on your watch page:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('evidence_available', 'Service evidence available', 'Your service evidence is ready to view — {{watch.model}}', 'Hello {{client.first_name}},\n\nTiming, pressure-test and parts photos from your {{watch.model}} service ({{job.number}}) are on your watch page:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('invoice_ready', 'Invoice ready', 'Your invoice {{so.number}} is ready', 'Hello {{client.first_name}},\n\nInvoice {{so.number}} for your {{watch.model}} is ready. Balance due: {{balance_due}}. View and pay here:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('ready_for_pickup', 'Ready for pickup', 'Your watch is ready for pickup', 'Hello {{client.first_name}},\n\nYour {{watch.brand}} {{watch.model}} is ready at the counter. Your pickup code and window options are here:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
  tpl('shipped', 'Shipped', 'Your watch has shipped', 'Hello {{client.first_name}},\n\nYour watch is on its way, insured and signature-required. Tracking and delivery details:\n\n▶ {{portal.link}}\n\n— The {{shop.name}} team'),
];

const ev = (id: string, jobId: string, watchId: string, slot: EvidenceItem['slot'], d: number, extra: Partial<EvidenceItem> = {}): EvidenceItem => ({ id, jobId, watchId, slot, photo: seedPhoto(`${slot} ${jobId}`), labelScan: `${jobId}-label`, at: daysAgo(d, 15), by: 'MH', station: 'Inspection Bench', ...extra });
export const evidence: EvidenceItem[] = [
  ev('ev-01', 'j-08', 'w-10', 'hidden_serial', 30), ev('ev-02', 'j-08', 'w-10', 'timing_sheet', 30, { note: 'before left / after right' }), ev('ev-03', 'j-08', 'w-10', 'pressure_test', 30, { depthRating: '100M/330ft' }), ev('ev-04', 'j-08', 'w-10', 'parts_grading', 30, { grades: ['B'] }),
  ev('ev-05', 'j-05', 'w-07', 'hidden_serial', 1), ev('ev-06', 'j-05', 'w-07', 'timing_sheet', 1),
  ev('ev-07', 'j-16', 'w-16', 'hidden_serial', 2), ev('ev-08', 'j-16', 'w-16', 'pressure_test', 2, { depthRating: '50M/164ft' }),
  ev('ev-09', 'j-25', 'w-21', 'hidden_serial', 400), ev('ev-10', 'j-25', 'w-21', 'timing_sheet', 400), ev('ev-11', 'j-25', 'w-21', 'pressure_test', 400, { depthRating: '200M/660ft' }), ev('ev-12', 'j-25', 'w-21', 'parts_grading', 400, { grades: ['Ø/REPL', 'D/REPL'] }),
];

export const integrations: IntegrationTile[] = [
  { key: 'qbo', name: 'QuickBooks Online', health: 'stub', blurb: 'Invoices queue locally with a fake QBO id. No OAuth, no push.', lastCheck: daysAgo(0, 8) },
  { key: 'shipping', name: 'Shipping provider', health: 'stub', blurb: 'Mock carrier seam issues SVG labels and fake tracking. No rates, no pickups.', lastCheck: daysAgo(0, 8) },
  { key: 'rollitime', name: 'RolliTime', health: 'stub', blurb: 'Timing bench runs inside this prototype at /rt (manual Witschi-style entry). No timing-machine import is wired.', lastCheck: daysAgo(0, 8) },
  { key: 'email', name: 'Email (Outbox)', health: 'stub', blurb: 'All client email lands in the Outbox and never sends.', lastCheck: daysAgo(0, 8) },
];
