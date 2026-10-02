import { PhoneCall,
  BarChart3,
  Boxes,
  Receipt,
  FilePlus2,
  FileText,
  HelpCircle,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquarePlus,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  Plug,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Wrench,
  type LucideIcon,
  Hammer,
  Map,
  ClipboardCheck,
  BookOpen,
  Users,
  MessagesSquare, MousePointerClick, Hand, ShieldAlert, Building2, CalendarDays, Camera, KeyRound, Globe, Target } from 'lucide-react';
import { OWNER_USER_ID, accessOverrideSync, type AccessTier, type User } from '@/api/client';
import { BONUS_ANALYTICS_USER_IDS } from '@/api/bonus';

export type NavGroupKey = 'intake' | 'clients' | 'rw' | 'parts';
// Expandable sidebar groups. `path` = the header itself is a page (Intake → /intake); no path = pure folder (RW).
export interface NavGroup { key: NavGroupKey; label: string; icon: LucideIcon; path?: string }
export const NAV_GROUPS: NavGroup[] = [
  { key: 'intake', label: 'Intake', icon: Inbox, path: '/intake' },
  { key: 'clients', label: 'Clients', icon: Users, path: '/clients' },
  { key: 'rw', label: 'RW', icon: Hammer },
  { key: 'parts', label: 'Parts & Inventory', icon: Boxes },
];

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tiers: AccessTier[];
  ownerOnly?: boolean;
  only?: string[];
  pinned?: boolean;
  group?: NavGroupKey;
  built?: boolean;
  blurb: string;
}

const ALL: AccessTier[] = ['manager', 'supervisor', 'concierge'];
const MGR: AccessTier[] = ['manager'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, tiers: ALL, built: true, blurb: 'Shop overview and daily priorities.' },
  // MH 2026-10-01: Inbox + Requests are their own top-level buttons directly below Dashboard (badges: unread · open requests without an estimate)
  { key: 'inbox', label: 'Inbox', path: '/inbox', icon: MessagesSquare, tiers: ALL, built: true, blurb: 'One general inbox: every client thread lands in All, unowned — tag, don’t assign; pin; Quoted / Answered; one-click archive. Internal tree (staff messages) and Calls alongside.' },
  { key: 'requests', label: 'Requests', path: '/requests', icon: MessageSquarePlus, tiers: ALL, built: true, blurb: 'RQ submissions before an estimate exists — an unowned pool: client, dots, source, age, optional tags (right-click); row click opens the thread + submission.' },
  { key: 'today', label: 'Hitlist', path: '/today', icon: ListChecks, tiers: ALL, pinned: true, built: true, blurb: 'Your personal work queue — bookmarkable at /hitlist/{you}: inbox, pinned, derived rows, tasks. Supervisors get a team rollup.' },
  { key: 'inbound', label: 'Shipping', path: '/shipping/inbound', icon: Truck, tiers: ALL, group: 'intake', built: true, blurb: 'Pre-arrival shipping: label requests, outstanding labels, in transit, delivered-unscanned. Track a package for a caller.' },
  { key: 'intake', label: 'Intake', path: '/intake', icon: Inbox, tiers: ALL, group: 'intake', built: true, blurb: 'Receive packages, log drop-offs and open new service tickets.' },
  { key: 'estimates', label: 'Estimates', path: '/estimates', icon: FileText, tiers: ALL, group: 'intake', built: true, blurb: 'Quotes awaiting approval and approved work.' },
  { key: 'appointments', label: 'Schedule', path: '/appointments', icon: CalendarDays, tiers: ALL, group: 'intake', built: true, blurb: 'Drop-off & pick-up appointments on the calendar — same booking rules as the public link.' },
  { key: 'clients', label: 'Clients', path: '/clients', icon: Users, tiers: ALL, group: 'clients', built: true, blurb: 'Client 360 — search any identifier, see their whole world.' },
  { key: 'calls', label: 'Calls', path: '/calls', icon: PhoneCall, tiers: MGR, group: 'clients', built: true, blurb: 'Global call log (Vonage): every call in and out, who answered, duration, disposition, recording link; missed-call badge.' },
  { key: 'jobs', label: 'Jobs', path: '/jobs', icon: Wrench, tiers: MGR, group: 'clients', built: true, blurb: 'Bench work in progress across departments.' },
  { key: 'all-jobs', label: 'All Jobs', path: '/jobs/all', icon: ListChecks, tiers: MGR, group: 'clients', built: true, blurb: 'Every job across the shop with combinable quick filters.' },
  { key: 'bench', label: 'Bench', path: '/bench', icon: Hammer, tiers: ALL, group: 'rw', built: true, blurb: 'My day — assigned jobs, next actions, holds, pull-next.' },
  { key: 'supervisor', label: 'Supervisor', path: '/supervisor', icon: ClipboardCheck, tiers: MGR, group: 'rw', built: true, blurb: 'Assign watchmakers, approve parts, park holds, QC queue.' },
  { key: 'floor', label: 'Shop Floor', path: '/floor', icon: Map, tiers: MGR, group: 'rw', built: true, blurb: 'Station map — WATCH / BRACELET tracks, manager safes, gate scans, Bulk assign, Component lookup.' },
  { key: 'assign-move', label: 'Assign / Move', path: '/assign', icon: MousePointerClick, tiers: MGR, built: true, blurb: 'Click a destination on the map, scan labels, commit — moves jobs without the detail board.' },
  { key: 'hitlist', label: 'MH Accountability', path: '/hitlist/owner', icon: ShieldAlert, tiers: ['manager'], ownerOnly: true, built: true, blurb: 'Owner accountability (MH only): live client-asset $ on premises + every bypass use.' },
  { key: 'custody', label: 'Custody', path: '/custody', icon: Hand, tiers: MGR, built: true, blurb: 'Who physically holds which watch head / case / bracelet right now, grouped by person.' },
  { key: 'sales', label: 'Sales', path: '/sales', icon: ShoppingCart, tiers: ALL, group: 'clients', built: true, blurb: 'Sales orders (invoices), payments, Pickup & Ship Stations.' },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: Boxes, tiers: MGR, group: 'parts', built: true, blurb: 'Parts, stock levels and reorder alerts.' },
  { key: 'cycle-count', label: 'Cycle count', path: '/inventory/count', icon: Boxes, tiers: ALL, group: 'parts', built: true, blurb: 'Count mode (scan) — counts and locations only; variance dollars are manager-only.' },
  { key: 'purchasing', label: 'Purchasing', path: '/purchasing', icon: PackageSearch, tiers: MGR, group: 'parts', built: true, blurb: 'Purchase orders, vendors and receiving.' },
  { key: 'concierge', label: 'Concierge', path: '/concierge', icon: Truck, tiers: MGR, built: true, blurb: 'Outsourced + in-house concierge work — one lane per vendor, lane shape by “do we ship to them?”, counts → cards → job. Replaces Shop Work Orders (same SWO model: custody, Paid, labels, QBO).' },
  { key: 'vendors', label: 'Vendors', path: '/purchasing/vendors', icon: Building2, tiers: MGR, group: 'parts', built: true, blurb: 'Vendor list, add / edit, detail roll-up: linked parts by last price, POs, purchase history.' },
  { key: 'parts-knowledge', label: 'Parts Knowledge', path: '/parts/knowledge', icon: BookOpen, tiers: MGR, group: 'parts', built: true, blurb: 'Part ↔ reference confirmations and aliases learned from approvals.' },
  { key: 'parts-catalog', label: 'Parts', path: '/parts', icon: Tag, tiers: MGR, group: 'parts', built: true, blurb: 'One part record · one stock count · one reorder rule · one caliber table · one search.' },
  { key: 'bill-audit', label: 'Bill Audit', path: '/shipping/bill-audit', icon: Receipt, tiers: MGR, group: 'intake', built: true, blurb: 'Carrier bill vs our label ledger — variances, voided-but-billed, disputes.' },
  { key: 'labels', label: 'Labels', path: '/labels', icon: Tag, tiers: ALL, built: true, blurb: 'Bag tags, shipping labels and QR codes.' },
  { key: 'wm-kiosk', label: 'WM Photo Kiosk', path: '/wm-kiosk', icon: Camera, tiers: ALL, built: true, blurb: 'Watchmaker-room shared photo station — required 4-step set + ad-hoc photos with @-mentions.' },
  { key: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, tiers: MGR, built: true, blurb: 'Revenue, throughput and turnaround reporting.' },
  { key: 'bonuses', label: 'Bonuses', path: '/analytics/bonuses', icon: Target, tiers: MGR, only: BONUS_ANALYTICS_USER_IDS, built: true, blurb: 'Bonus targets (MH + Operations Manager): actual vs target, working-day pace, projected payout, EOM close, Mark paid, CSV.' },
  { key: 'accounting', label: 'Accounting', path: '/accounting', icon: Landmark, tiers: MGR, built: true, blurb: 'QuickBooks sync, ledgers and reconciliation.' },
  { key: 'rwcom', label: 'rw.com', path: '/rwcom', icon: Globe, tiers: MGR, built: true, blurb: 'Emulator of the public rolliworks.com flows — identify · check · request — with a phone/desktop frame. NOT-KEEPER: in KEEPER this is the public site, not an RS screen.' },
  { key: 'setup', label: 'Setup', path: '/setup', icon: Settings, tiers: MGR, built: true, blurb: 'Users, departments, templates and preferences.' },
  { key: 'access', label: 'Access control', path: '/setup/access', icon: KeyRound, tiers: ['manager'], ownerOnly: true, built: true, blurb: 'Owner-only: per-user × per-screen toggles with role defaults, override diff and a change log.' },
  { key: 'integrations', label: 'Integrations', path: '/integrations', icon: Plug, tiers: MGR, built: true, blurb: 'QuickBooks, email, SMS and shipping carriers.' },
  { key: 'help', label: 'Help', path: '/help', icon: HelpCircle, tiers: ALL, built: true, blurb: 'Guides, keyboard shortcuts and support.' },
];

export interface QuickAction {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  blurb: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'drop-off', label: 'Drop-off', path: '/actions/drop-off', icon: PackageOpen, blurb: 'Log a walk-in drop-off and print a bag tag.' },
  { key: 'request', label: 'Request', path: '/actions/request', icon: MessageSquarePlus, blurb: 'Create a service request from a call or email.' },
  { key: 'estimate', label: 'Estimate', path: '/actions/estimate', icon: FilePlus2, blurb: 'Start a new estimate for a watch in house.' },
  { key: 'ship', label: 'Ship', path: '/sales/ship', icon: Truck, blurb: 'Create an insured outbound shipment.' },
  { key: 'pickup', label: 'Pickup', path: '/sales/pickup', icon: PackageCheck, blurb: 'Release a finished watch to its owner.' },
];

// Role default from the tier table; a per-user override (Access control panel, owner-only) wins. Owner-only screens never open by override.
export const roleDefaultAccess = (i: NavItem, user: Pick<User, 'id' | 'accessTier'>) => i.tiers.includes(user.accessTier) && (!i.ownerOnly || user.id === OWNER_USER_ID) && (!i.only || i.only.includes(user.id));
export const canAccess = (i: NavItem, user: Pick<User, 'id' | 'accessTier'>) => { if (i.ownerOnly) return user.id === OWNER_USER_ID; if (i.only && !i.only.includes(user.id)) return false; const o = accessOverrideSync(user.id, i.key); return o === undefined ? roleDefaultAccess(i, user) : o; };
export const navForTier = (tier: AccessTier) => NAV_ITEMS.filter((i) => i.tiers.includes(tier));
export const SCREENS = NAV_ITEMS.filter((i) => !i.ownerOnly);
export const navForUser = (user: Pick<User, 'id' | 'accessTier'>) => NAV_ITEMS.filter((i) => canAccess(i, user));

export const findNavItem = (pathname: string) =>
  NAV_ITEMS.filter((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(i.path + '/'))).sort((a, b) => b.path.length - a.path.length)[0];
