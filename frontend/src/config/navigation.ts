import {
  BarChart3,
  Boxes,
  Camera,
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
} from 'lucide-react';
import type { AccessTier } from '@/api/client';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tiers: AccessTier[];
  pinned?: boolean;
  built?: boolean;
  blurb: string;
}

const ALL: AccessTier[] = ['manager', 'concierge'];
const MGR: AccessTier[] = ['manager'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, tiers: ALL, built: true, blurb: 'Shop overview and daily priorities.' },
  { key: 'hit-list', label: 'Daily Hit List', path: '/hit-list', icon: ListChecks, tiers: ALL, pinned: true, built: true, blurb: 'Today’s to-dos by owner.' },
  { key: 'intake', label: 'Intake', path: '/intake', icon: Inbox, tiers: ALL, blurb: 'Receive packages, log drop-offs and open new service tickets.' },
  { key: 'estimates', label: 'Estimates', path: '/estimates', icon: FileText, tiers: ALL, built: true, blurb: 'Quotes awaiting approval and approved work.' },
  { key: 'jobs', label: 'Jobs', path: '/jobs', icon: Wrench, tiers: MGR, built: true, blurb: 'Bench work in progress across departments.' },
  { key: 'inspection-photos', label: 'Inspection Photos', path: '/inspection-photos', icon: Camera, tiers: MGR, blurb: 'Before / after photo sets per watch.' },
  { key: 'sales', label: 'Sales', path: '/sales', icon: ShoppingCart, tiers: MGR, blurb: 'Sales orders, invoices and payments.' },
  { key: 'purchasing', label: 'Purchasing', path: '/purchasing', icon: PackageSearch, tiers: MGR, blurb: 'Purchase orders, vendors and receiving.' },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: Boxes, tiers: MGR, blurb: 'Parts, stock levels and reorder alerts.' },
  { key: 'labels', label: 'Labels', path: '/labels', icon: Tag, tiers: ALL, blurb: 'Bag tags, shipping labels and QR codes.' },
  { key: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, tiers: MGR, blurb: 'Revenue, throughput and turnaround reporting.' },
  { key: 'accounting', label: 'Accounting', path: '/accounting', icon: Landmark, tiers: MGR, blurb: 'QuickBooks sync, ledgers and reconciliation.' },
  { key: 'setup', label: 'Setup', path: '/setup', icon: Settings, tiers: MGR, built: true, blurb: 'Users, departments, templates and preferences.' },
  { key: 'integrations', label: 'Integrations', path: '/integrations', icon: Plug, tiers: MGR, blurb: 'QuickBooks, email, SMS and shipping carriers.' },
  { key: 'help', label: 'Help', path: '/help', icon: HelpCircle, tiers: ALL, blurb: 'Guides, keyboard shortcuts and support.' },
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
  { key: 'ship', label: 'Ship', path: '/actions/ship', icon: Truck, blurb: 'Create an insured outbound shipment.' },
  { key: 'pickup', label: 'Pickup', path: '/actions/pickup', icon: PackageCheck, blurb: 'Release a finished watch to its owner.' },
];

export const navForTier = (tier: AccessTier) => NAV_ITEMS.filter((i) => i.tiers.includes(tier));

export const findNavItem = (pathname: string) =>
  NAV_ITEMS.find((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(i.path + '/')));
