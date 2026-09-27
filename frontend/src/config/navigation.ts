import {
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
  MessagesSquare, MousePointerClick } from 'lucide-react';
import type { AccessTier } from '@/api/client';

export type NavGroupKey = 'intake' | 'clients' | 'rw';
// Expandable sidebar groups. `path` = the header itself is a page (Intake → /intake); no path = pure folder (RW).
export interface NavGroup { key: NavGroupKey; label: string; icon: LucideIcon; path?: string }
export const NAV_GROUPS: NavGroup[] = [
  { key: 'intake', label: 'Intake', icon: Inbox, path: '/intake' },
  { key: 'clients', label: 'Clients', icon: Users, path: '/clients' },
  { key: 'rw', label: 'RW', icon: Hammer },
];

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tiers: AccessTier[];
  pinned?: boolean;
  group?: NavGroupKey;
  built?: boolean;
  blurb: string;
}

const ALL: AccessTier[] = ['manager', 'concierge'];
const MGR: AccessTier[] = ['manager'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, tiers: ALL, built: true, blurb: 'Shop overview and daily priorities.' },
  { key: 'today', label: 'Today', path: '/today', icon: ListChecks, tiers: ALL, pinned: true, built: true, blurb: 'Your derived hit list — owner actions, bench work, holds, discrepancies, tasks.' },
  { key: 'requests', label: 'Requests', path: '/requests', icon: MessageSquarePlus, tiers: ALL, group: 'intake', built: true, blurb: 'Service requests queue — calls, emails, web forms and kiosk check-ins; kiosk matches to confirm.' },
  { key: 'inbox', label: 'Inbox', path: '/inbox', icon: MessagesSquare, tiers: ALL, group: 'intake', built: true, blurb: 'Client messages from RolliConnect; replies queue to Outbox.' },
  { key: 'inbound', label: 'Shipping', path: '/shipping/inbound', icon: Truck, tiers: ALL, group: 'intake', built: true, blurb: 'Pre-arrival shipping: label requests, outstanding labels, in transit, delivered-unscanned. Track a package for a caller.' },
  { key: 'intake', label: 'Intake', path: '/intake', icon: Inbox, tiers: ALL, group: 'intake', built: true, blurb: 'Receive packages, log drop-offs and open new service tickets.' },
  { key: 'estimates', label: 'Estimates', path: '/estimates', icon: FileText, tiers: ALL, group: 'intake', built: true, blurb: 'Quotes awaiting approval and approved work.' },
  { key: 'clients', label: 'Clients', path: '/clients', icon: Users, tiers: ALL, group: 'clients', built: true, blurb: 'Client 360 — search any identifier, see their whole world.' },
  { key: 'jobs', label: 'Jobs', path: '/jobs', icon: Wrench, tiers: MGR, group: 'clients', built: true, blurb: 'Bench work in progress across departments.' },
  { key: 'all-jobs', label: 'All Jobs', path: '/jobs/all', icon: ListChecks, tiers: MGR, group: 'clients', built: true, blurb: 'Every job across the shop with combinable quick filters.' },
  { key: 'bench', label: 'Bench', path: '/bench', icon: Hammer, tiers: ALL, group: 'rw', built: true, blurb: 'My day — assigned jobs, next actions, holds, pull-next.' },
  { key: 'supervisor', label: 'Supervisor', path: '/supervisor', icon: ClipboardCheck, tiers: MGR, group: 'rw', built: true, blurb: 'Assign watchmakers, approve parts, park holds, QC queue.' },
  { key: 'floor', label: 'Shop Floor', path: '/floor', icon: Map, tiers: MGR, group: 'rw', built: true, blurb: 'Station map — WATCH / BRACELET tracks, manager safes, gate scans, Bulk assign, Component lookup.' },
  { key: 'assign-move', label: 'Assign / Move', path: '/assign', icon: MousePointerClick, tiers: MGR, built: true, blurb: 'Click a destination on the map, scan labels, commit — moves jobs without the detail board.' },
  { key: 'parts-knowledge', label: 'Parts Knowledge', path: '/parts/knowledge', icon: BookOpen, tiers: MGR, built: true, blurb: 'Part ↔ reference confirmations and aliases learned from approvals.' },
  { key: 'sales', label: 'Sales', path: '/sales', icon: ShoppingCart, tiers: ALL, group: 'clients', built: true, blurb: 'Sales orders (invoices), payments, Pickup & Ship Stations.' },
  { key: 'purchasing', label: 'Purchasing', path: '/purchasing', icon: PackageSearch, tiers: MGR, built: true, blurb: 'Purchase orders, vendors and receiving.' },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: Boxes, tiers: MGR, built: true, blurb: 'Parts, stock levels and reorder alerts.' },
  { key: 'bill-audit', label: 'Bill Audit', path: '/shipping/bill-audit', icon: Receipt, tiers: MGR, group: 'intake', built: true, blurb: 'Carrier bill vs our label ledger — variances, voided-but-billed, disputes.' },
  { key: 'labels', label: 'Labels', path: '/labels', icon: Tag, tiers: ALL, built: true, blurb: 'Bag tags, shipping labels and QR codes.' },
  { key: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, tiers: MGR, built: true, blurb: 'Revenue, throughput and turnaround reporting.' },
  { key: 'accounting', label: 'Accounting', path: '/accounting', icon: Landmark, tiers: MGR, built: true, blurb: 'QuickBooks sync, ledgers and reconciliation.' },
  { key: 'setup', label: 'Setup', path: '/setup', icon: Settings, tiers: MGR, built: true, blurb: 'Users, departments, templates and preferences.' },
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

export const navForTier = (tier: AccessTier) => NAV_ITEMS.filter((i) => i.tiers.includes(tier));

export const findNavItem = (pathname: string) =>
  NAV_ITEMS.find((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(i.path + '/')));
