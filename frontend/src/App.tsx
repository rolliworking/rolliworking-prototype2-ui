import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ToastHost, toast } from '@/components/ui/Toast';
import { desktopAllowed, padAllowed, roleKind, rwAllowed, ROLE_HOME, ROLE_LABEL, type RoleKind } from '@/config/roles';
import AppShell from '@/components/layout/AppShell';
import IntakeLayout from '@/components/intake/IntakeLayout';
import { canAccess, findNavItem } from '@/config/navigation';
import RcShell from '@/rc/RcShell';
import RwShell, { RwRestricted } from '@/pages/rw/RwShell';
import { SAFES_ALERT_EVENT } from '@/api/safes';
import { ActionPlaceholder, NotFound, RestrictedPage, SectionPlaceholder } from '@/pages/Placeholders';
import '@/api/inventoryReports';
import '@/api/custody';
import { ViewAsBanner } from '@/components/layout/ViewAs';

// Route chunks (2026-10-03): every page is its own chunk, so a cold load fetches the shell + ONE page instead of ~400 source modules (the preview proxy 429s on the unbundled dev load). Per-element Suspense keeps the shells mounted while a chunk loads.
const RouteLoading = () => <div data-testid="route-loading" className="px-6 py-5 text-xs text-ink-400">Loading…</div>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;
const lz = (load: () => Promise<{ default: AnyComp }>): AnyComp => { const C = lazy(load); return (props) => <Suspense fallback={<RouteLoading />}><C {...props} /></Suspense>; };
const named = <M extends object>(load: () => Promise<M>, key: keyof M): AnyComp => lz(() => load().then((m) => ({ default: m[key] as unknown as AnyComp })));

const AuditLogPage = lz(() => import('@/pages/AuditLogPage'));
const ClientsPage = lz(() => import('@/pages/clients/ClientsPage'));
const Client360Page = lz(() => import('@/pages/clients/Client360Page'));
const InboxPage = lz(() => import('@/pages/InboxPage'));
const RwJobsPage = lz(() => import('@/pages/rw/RwJobsPage'));
const RwJobPage = lz(() => import('@/pages/rw/RwJobPage'));
const RwPartsPage = lz(() => import('@/pages/rw/RwPartsPage'));
const RwQcPage = lz(() => import('@/pages/rw/RwQcPage'));
const RwEvidencePage = lz(() => import('@/pages/rw/RwEvidencePage'));
const RwFloorPage = lz(() => import('@/pages/rw/RwFloorPage'));
const AssignMovePage = lz(() => import('@/pages/rw/AssignMovePage'));
const CustodyPage = lz(() => import('@/pages/rw/CustodyPage'));
const CallsPage = lz(() => import('@/pages/rs/CallsPage'));
const PartsPage = lz(() => import('@/pages/rs/PartsPage'));
const ApprovalsToSendPage = lz(() => import('@/pages/rs/ApprovalsToSendPage'));
const HitlistPage = lz(() => import('@/pages/rs/HitlistPage'));
const RwcomPage = lz(() => import('@/pages/RwcomPage'));
const RwBulkAssignPage = lz(() => import('@/pages/rw/RwBulkAssignPage'));
const RwWorkQueuePage = lz(() => import('@/pages/rw/RwWorkQueuePage'));
const RwWmPage = lz(() => import('@/pages/rw/RwWmPage'));
const RwStationScanPage = lz(() => import('@/pages/rw/RwStationScanPage'));
const RwPadPage = lz(() => import('@/pages/rw/RwPadPage'));
const RwBenchPage = lz(() => import('@/pages/rw/RwBenchPage'));
const RwPickingPage = lz(() => import('@/pages/rw/RwPickingPage'));
const RwHistoryPage = lz(() => import('@/pages/rw/RwHistoryPage'));
const RwDevicePage = lz(() => import('@/pages/rw/RwDevicePage'));
const RwConciergePage = lz(() => import('@/pages/rw/RwConciergePage'));
const RwReportsPage = lz(() => import('@/pages/rw/RwReportsPage'));
const AllJobsPage = lz(() => import('@/pages/jobs/AllJobsPage'));
const IntakeAwaitingApprovalPage = named(() => import('@/pages/intake/IntakeStepPages'), 'IntakeAwaitingApprovalPage');
const IntakeInspectionFormStep = named(() => import('@/pages/intake/IntakeStepPages'), 'IntakeInspectionFormStep');
const IntakeInspectionListPage = named(() => import('@/pages/intake/IntakeStepPages'), 'IntakeInspectionListPage');
const IntakePhotosPage = named(() => import('@/pages/intake/IntakeStepPages'), 'IntakePhotosPage');
const RcInspectionFormPage = lz(() => import('@/pages/rc/RcInspectionFormPage'));
const QboSetupPage = lz(() => import('@/pages/rs/QboSetupPage'));
const Wm8SetupPage = lz(() => import('@/pages/rs/Wm8SetupPage'));
const KioskPage = lz(() => import('@/pages/kiosk/KioskPage'));
const TimeClockPage = lz(() => import('@/pages/time/TimeClockPage'));
const TimeClockPad = lz(() => import('@/pages/time/TimeClockPad'));
const WmKioskPage = lz(() => import('@/pages/kiosk/WmKioskPage'));
const PayPage = lz(() => import('@/pages/PayPage'));
const RequestsPage = lz(() => import('@/pages/RequestsPage'));
const RwTestingQueuePage = lz(() => import('@/pages/rw/testing/RwTestingQueuePage'));
const RwTestingTestPage = lz(() => import('@/pages/rw/testing/RwTestingTestPage'));
const RcLoginPage = lz(() => import('@/pages/rc/RcLoginPage'));
const RcSignupPage = lz(() => import('@/pages/rc/RcSignupPage'));
const RcAccountPage = lz(() => import('@/pages/rc/RcAccountPage'));
const RcHomePage = lz(() => import('@/pages/rc/RcHomePage'));
const RcEstimatePage = lz(() => import('@/pages/rc/RcEstimatePage'));
const RcInvoicePage = lz(() => import('@/pages/rc/RcInvoicePage'));
const RcWatchPage = lz(() => import('@/pages/rc/RcWatchPage'));
const RcPartsPage = lz(() => import('@/pages/rc/RcPartsPage'));
const RcReportPage = lz(() => import('@/pages/rc/RcReportPage'));
const RcMessagesPage = lz(() => import('@/pages/rc/RcMessagesPage'));
const RcNotFound = lz(() => import('@/pages/rc/RcNotFound'));
const RcPickupConfirmPage = lz(() => import('@/pages/rc/RcPickupConfirmPage'));
const RcMagicPage = lz(() => import('@/pages/rc/RcMagicPage'));
const RcRequestNewPage = lz(() => import('@/pages/rc/RcRequestNewPage'));
const RequestNewPage = lz(() => import('@/pages/RequestNewPage'));
const RateCardPage = lz(() => import('@/pages/setup/RateCardPage'));
const TemplatesPage = lz(() => import('@/pages/setup/TemplatesPage'));
const BonusPlansPage = lz(() => import('@/pages/setup/BonusPlansPage'));
const ContainersPage = lz(() => import('@/pages/setup/ContainersPage'));
const CustodySetupPage = lz(() => import('@/pages/setup/CustodySetupPage'));
const OrganisationPage = lz(() => import('@/pages/setup/OrganisationPage'));
const AnalyticsPage = lz(() => import('@/pages/analytics/AnalyticsPage'));
const Dashboard = lz(() => import('@/pages/Dashboard'));
const EstimateCreatePage = lz(() => import('@/pages/estimates/EstimateCreatePage'));
const EstimateDetailPage = lz(() => import('@/pages/estimates/EstimateDetailPage'));
const EstimatesListPage = lz(() => import('@/pages/estimates/EstimatesListPage'));
const PersonHitlistPage = lz(() => import('@/pages/hitlist/PersonHitlistPage'));
const HitlistIndex = named(() => import('@/pages/hitlist/PersonHitlistPage'), 'HitlistIndex');
const HomeRedirect = named(() => import('@/pages/hitlist/PersonHitlistPage'), 'HomeRedirect');
const TeamHitlistPage = lz(() => import('@/pages/hitlist/TeamHitlistPage'));
const AppraisalPage = lz(() => import('@/pages/jobs/AppraisalPage'));
const ArrivalPage = lz(() => import('@/pages/intake/ArrivalPage'));
const LabelQueuePage = lz(() => import('@/pages/intake/LabelQueuePage'));
const SentPage = lz(() => import('@/pages/intake/SentPage'));
const ReceivePackageListPage = lz(() => import('@/pages/intake/ReceivePackageListPage'));
const ReceivePackagePage = lz(() => import('@/pages/intake/ReceivePackagePage'));
const ReceiveWatchListPage = lz(() => import('@/pages/intake/ReceiveWatchListPage'));
const ReceiveWatchPage = lz(() => import('@/pages/intake/ReceiveWatchPage'));
const WatchIntakeHistoryPage = lz(() => import('@/pages/intake/WatchIntakeHistoryPage'));
const WorkOrderPage = lz(() => import('@/pages/intake/WorkOrderPage'));
const TradeScanInPage = lz(() => import('@/pages/intake/TradeScanInPage'));
const JobsPage = lz(() => import('@/pages/JobsPage'));
const JobCreatePage = lz(() => import('@/pages/jobs/JobCreatePage'));
const JobDetailPage = lz(() => import('@/pages/jobs/JobDetailPage'));
const ShopTimePage = lz(() => import('@/pages/jobs/ShopTimePage'));
const SalesOrdersPage = lz(() => import('@/pages/sales/SalesOrdersPage'));
const SalesOrderDetailPage = lz(() => import('@/pages/sales/SalesOrderDetailPage'));
const PickupStationPage = lz(() => import('@/pages/sales/PickupStationPage'));
const ShipStationPage = lz(() => import('@/pages/sales/ShipStationPage'));
const InboundShippingPage = lz(() => import('@/pages/shipping/InboundShippingPage'));
const BillAuditPage = lz(() => import('@/pages/shipping/BillAuditPage'));
const BenchPage = lz(() => import('@/pages/workshop/BenchPage'));
const SupervisorPage = lz(() => import('@/pages/workshop/SupervisorPage'));
const FloorMapPage = lz(() => import('@/pages/workshop/FloorMapPage'));
const PartsKnowledgePage = lz(() => import('@/pages/workshop/PartsKnowledgePage'));
const SetupPage = lz(() => import('@/pages/SetupPage'));
const ConciergePage = lz(() => import('@/pages/rs/ConciergePage'));
const SwoListPage = lz(() => import('@/pages/rs/SwoPage'));
const SwoHubPage = lz(() => import('@/pages/rs/SwoHubPage'));
const RwMessagesPage = lz(() => import('@/pages/rw/RwMessagesPage'));
const RwInspectPage = lz(() => import('@/pages/rw/RwInspectPage'));
const InspectionSetupPage = lz(() => import('@/pages/setup/InspectionSetupPage'));
const AccessControlPage = lz(() => import('@/pages/rs/AccessControlPage'));
const PurchasingPage = lz(() => import('@/pages/rs/PurchasingPage'));
const VendorsPage = lz(() => import('@/pages/rs/VendorsPage'));
const VendorDetailPage = named(() => import('@/pages/rs/VendorsPage'), 'VendorDetailPage');
const SchedulePage = lz(() => import('@/pages/SchedulePage'));
const InventoryPage = lz(() => import('@/pages/rs/InventoryPage'));
const InventoryReportsPage = lz(() => import('@/pages/rs/InventoryReportsPage'));
const CycleCountPage = lz(() => import('@/pages/rs/CycleCountPage'));
const AccountingPage = named(() => import('@/pages/rs/RsPages'), 'AccountingPage');
const HelpPage = named(() => import('@/pages/rs/RsPages'), 'HelpPage');
const IntegrationsPage = named(() => import('@/pages/rs/RsPages'), 'IntegrationsPage');
const LabelsPage = named(() => import('@/pages/rs/RsPages'), 'LabelsPage');
const ReportsPage = named(() => import('@/pages/rs/RsPages'), 'ReportsPage');
const SignInPage = lz(() => import('@/pages/SignInPage'));
const ChooseViewPage = lz(() => import('@/pages/ChooseViewPage'));
const StationSetupPage = lz(() => import('@/pages/StationSetupPage'));

function RequireAuth() {
  const { user, station, loading } = useAuth();
  if (loading) return null;
  if (!station) return <Navigate to="/station-setup" replace />;
  if (!user) return <Navigate to="/sign-in" replace />;
  // Role guard: a watchmaker typing any desktop route is sent to the RW bench before any data loads
  const k = roleKind(user); if (!desktopAllowed(k)) return <RoleRedirect to={ROLE_HOME[k]} label="the desktop app" role={k} />;
  return <AppShell />;
}
function RoleRedirect({ to, label, role }: { to: string; label: string; role: RoleKind }) {
  useEffect(() => { toast.warn(`Not available for your role (${ROLE_LABEL[role]}) — ${label} is not part of your view`); }, [label, role]);
  return <Navigate to={to} replace />;
}
// RW shell guard: concierge never enters the RW app; the Supervisor Pad is supervisors / managers only
function RwRoleGuard({ pad, band, children }: { pad?: boolean; band?: boolean; children: JSX.Element }) {
  const { user } = useAuth(); if (!user) return children;
  const k = roleKind(user);
  if (!rwAllowed(k)) return <RoleRedirect to={ROLE_HOME[k]} label="the RolliWorking bench app" role={k} />;
  // Band Pad is the band/polish techs' own home; every other pad-tier route needs a supervisor / manager
  if (pad && !padAllowed(k) && !(band && k === 'band_tech')) return <RoleRedirect to={ROLE_HOME[k]} label="the Supervisor Pad" role={k} />;
  return children;
}

// /rg → Time Clock: tag URLs (/rg/clock?station=…) keep their query, manager/week land on the desktop board
function RgRedirect() {
  const { pathname, search } = useLocation();
  const to = pathname.startsWith('/rg/manager') ? '/time' : pathname.startsWith('/rg/week') ? '/time?tab=week' : `/time/pad${search}`;
  return <Navigate to={to} replace />;
}

function TierGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  if (item && !canAccess(item, user!)) return <RestrictedPage label={item.label} />;
  return <Outlet />;
}

const PLACEHOLDER_PATHS: string[] = [];

function RwManagerOnly({ label, children }: { label: string; children: JSX.Element }) {
  const { user } = useAuth();
  return user?.accessTier === 'manager' ? children : <RwRestricted label={label} />;
}

const InspectionRedirect = () => { const { id } = useParams(); const { search } = useLocation(); return <Navigate to={`/intake/inspect/${id}${search}`} replace />; };
const InspectionNewRedirect = () => { const { search } = useLocation(); return <Navigate to={`/intake/inspect/new${search}`} replace />; };
const RtRedirect = () => { const { jobId } = useParams(); return <Navigate to={`/rw/testing/test/${jobId}`} replace />; };
// Super-admin staff-message folders live inside the Inbox's Internal tree (one tree, Outlook layout); /messages/all?staff=<Short> is the URL those folders resolve to
const MessagesAllRedirect = () => { const [p] = useSearchParams(); return <Navigate to={`/inbox?section=staff&staff=${encodeURIComponent(p.get('staff') ?? 'all')}${p.get('msg') ? `&msg=${p.get('msg')}` : ''}`} replace />; };

export default function App() {
  // Safes vs insurance: the scan that tips a safe over its limit shows a non-blocking warning wherever the staffer is
  useEffect(() => { const h = (e: Event) => toast.warn((e as CustomEvent<string>).detail); window.addEventListener(SAFES_ALERT_EVENT, h); return () => window.removeEventListener(SAFES_ALERT_EVENT, h); }, []);
  return (
    <BrowserRouter>
      <ToastHost />
      <AuthProvider>
        <ViewAsBanner />
        <Routes>
          <Route path="/station-setup" element={<StationSetupPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/choose-view" element={<ChooseViewPage />} />
          {/* RolliConnect — client portal. Separate shell, separate session, no staff routes reachable. */}
          {/* E11 — RolliWorking standalone: workshop route-space, own shell, RS routes not reachable (access boundary) */}
          <Route path="/rw" element={<RwRoleGuard><RwShell /></RwRoleGuard>}>
            <Route index element={<BenchPage />} />
            <Route path="jobs" element={<RwJobsPage />} />
            <Route path="jobs/:id" element={<RwJobPage />} />
            <Route path="parts" element={<RwPartsPage />} />
            <Route path="qc" element={<RwManagerOnly label="QC"><RwQcPage /></RwManagerOnly>} />
            <Route path="supervisor" element={<RwManagerOnly label="Supervisor board"><SupervisorPage /></RwManagerOnly>} />
            <Route path="floor" element={<RwFloorPage />} />
            <Route path="assign" element={<RwRoleGuard pad><div className="mx-6 my-5"><AssignMovePage /></div></RwRoleGuard>} />
            <Route path="queue" element={<RwRoleGuard pad><RwWorkQueuePage /></RwRoleGuard>} />
            <Route path="bulk" element={<RwManagerOnly label="Bulk Assign"><RwBulkAssignPage /></RwManagerOnly>} />
            <Route path="wm" element={<RwWmPage />} />
            <Route path="station" element={<RwRoleGuard pad><RwStationScanPage /></RwRoleGuard>} />
            <Route path="pad" element={<RwRoleGuard pad><RwPadPage room="wm" /></RwRoleGuard>} />
            <Route path="band" element={<RwRoleGuard pad band><RwPadPage room="band" /></RwRoleGuard>} />
            <Route path="history" element={<RwHistoryPage />} />
            <Route path="device" element={<RwDevicePage />} />
            <Route path="concierge" element={<RwRoleGuard pad><RwConciergePage /></RwRoleGuard>} />
            <Route path="swo/:id" element={<RwRoleGuard pad><div className="mx-2 my-1"><SwoHubPage /></div></RwRoleGuard>} />
            <Route path="reports" element={<RwReportsPage />} />
            <Route path="bench" element={<RwBenchPage />} />
            <Route path="picking" element={<RwPickingPage />} />
            <Route path="evidence" element={<RwEvidencePage />} />
            <Route path="messages" element={<RwMessagesPage />} />
            <Route path="inspect" element={<RwInspectPage />} />
            <Route path="inspect/:jobId" element={<RwInspectPage />} />
            <Route path="testing" element={<RwTestingQueuePage />} />
            <Route path="testing/test/:jobId" element={<RwTestingTestPage />} />
            <Route path="today" element={<HitlistIndex />} />
            <Route path="hitlist" element={<HitlistIndex />} />
            <Route path="hitlist/:slug" element={<PersonHitlistPage />} />
            <Route path="hitlist/:slug/team" element={<TeamHitlistPage />} />
            <Route path="*" element={<Navigate to="/rw" replace />} />
          </Route>
          {/* Time Clock pad (wall iPad + NFC tag taps). RGTime is retired: every /rg URL redirects here with its query string so printed tags keep working (D-498). */}
          <Route path="/time/pad" element={<TimeClockPad />} />
          <Route path="/rg/*" element={<RgRedirect />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/pay/:token" element={<PayPage />} />
          <Route path="/rc" element={<RcShell />}>
            <Route index element={<RcLoginPage />} />
            <Route path="signup" element={<RcSignupPage />} />
            <Route path="account" element={<RcAccountPage />} />
            <Route path="home" element={<RcHomePage />} />
            <Route path="estimates/:id" element={<RcEstimatePage />} />
            <Route path="invoices/:id" element={<RcInvoicePage />} />
            <Route path="watches/:id" element={<RcWatchPage />} />
            <Route path="parts/:id" element={<RcPartsPage />} />
            <Route path="report/:token" element={<RcReportPage />} />
            <Route path="inspection/:token" element={<RcInspectionFormPage />} />
            <Route path="pickup/:token" element={<RcPickupConfirmPage />} />
            <Route path="auth/:token" element={<RcMagicPage />} />
            <Route path="messages" element={<RcMessagesPage />} />
            <Route path="request/new" element={<RcRequestNewPage />} />
            <Route path="*" element={<RcNotFound />} />
          </Route>
          {/* Public rw.com (emulator) — where /rc/request/new sends visitors without a portal session (D-418) */}
          <Route path="/www" element={<div data-testid="www-public" className="min-h-screen bg-canvas px-6 py-5"><RwcomPage /></div>} />
          {/* RolliTime re-homed into RW (2026-09-27) — old /rt routes redirect */}
          <Route path="/rt" element={<Navigate to="/rw/testing" replace />} />
          <Route path="/rt/test/:jobId" element={<RtRedirect />} />
          <Route element={<RequireAuth />}>
            <Route element={<TierGate />}>
              <Route index element={<Dashboard />} />
              <Route path="/home" element={<HomeRedirect />} />
              <Route path="/today" element={<HitlistIndex />} />
              <Route path="/hit-list" element={<Navigate to="/today" replace />} />
              <Route path="/hitlist" element={<HitlistIndex />} />
              <Route path="/hitlist/owner" element={<HitlistPage />} />
              <Route path="/rwcom" element={<RwcomPage />} />
              <Route path="/hitlist/:slug" element={<PersonHitlistPage />} />
              <Route path="/hitlist/:slug/team" element={<TeamHitlistPage />} />
              <Route path="/estimates" element={<EstimatesListPage />} />
              <Route path="/estimates/new" element={<EstimateCreatePage />} />
              <Route path="/estimates/:id" element={<EstimateDetailPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/new" element={<JobCreatePage />} />
              <Route path="/jobs/all" element={<AllJobsPage />} />
              <Route path="/jobs/:jobId/appraisal/:id" element={<AppraisalPage />} />
              <Route path="/inspection/new" element={<InspectionNewRedirect />} />
              <Route path="/inspection/:id" element={<InspectionRedirect />} />
              <Route path="/inspection-photos" element={<Navigate to="/intake/photos" replace />} />
              <Route path="/jobs/shop-time" element={<ShopTimePage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/intake" element={<IntakeLayout />}>
                <Route index element={<ArrivalPage />} />
                <Route path="receive" element={<ReceivePackageListPage />} />
                <Route path="receive/:id" element={<ReceivePackagePage />} />
                <Route path="work-order" element={<WorkOrderPage />} />
                <Route path="inspection" element={<ReceiveWatchListPage />} />
                <Route path="inspection/:id" element={<ReceiveWatchPage />} />
                <Route path="history" element={<WatchIntakeHistoryPage />} />
                <Route path="photos" element={<IntakePhotosPage />} />
                <Route path="inspect" element={<IntakeInspectionListPage />} />
                <Route path="inspect/new" element={<IntakeInspectionFormStep />} />
                <Route path="inspect/:id" element={<IntakeInspectionFormStep />} />
                <Route path="awaiting-approval" element={<IntakeAwaitingApprovalPage />} />
                <Route path="sent" element={<SentPage />} />
                <Route path="outbox" element={<Navigate to="/intake/sent" replace />} />
                <Route path="labels" element={<LabelQueuePage />} />
                <Route path="trade" element={<TradeScanInPage />} />
              </Route>
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/messages/all" element={<MessagesAllRedirect />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/requests/new" element={<RequestNewPage />} />
              <Route path="/requests/:id" element={<RequestsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<Client360Page />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/time" element={<TimeClockPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/setup/access" element={<AccessControlPage />} />
              <Route path="/setup/inspection" element={<InspectionSetupPage />} />
              <Route path="/setup/rate-card" element={<RateCardPage />} />
              <Route path="/setup/templates" element={<TemplatesPage />} />
              <Route path="/setup/bonus-plans" element={<BonusPlansPage />} />
              <Route path="/setup/containers" element={<ContainersPage />} />
              <Route path="/setup/custody" element={<CustodySetupPage />} />
              <Route path="/setup/org" element={<OrganisationPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/analytics/bonuses" element={<AnalyticsPage />} />
              <Route path="/wm-kiosk" element={<WmKioskPage />} />
              <Route path="/setup/audit-log" element={<AuditLogPage />} />
              <Route path="/bench" element={<BenchPage />} />
              <Route path="/supervisor" element={<SupervisorPage />} />
              <Route path="/floor" element={<div data-testid="desktop-shop-floor" className="-mx-6 -my-5 min-h-[calc(100%+2.5rem)] bg-[#161b22] px-6 py-5 text-slate-100"><RwFloorPage /></div>} />
              <Route path="/floor/lanes" element={<FloorMapPage />} />
              <Route path="/assign" element={<AssignMovePage />} />
              <Route path="/custody" element={<CustodyPage />} />
              <Route path="/parts/knowledge" element={<PartsKnowledgePage />} />
              <Route path="/parts" element={<PartsPage />} />
              <Route path="/parts/approvals" element={<ApprovalsToSendPage />} />
              <Route path="/appointments" element={<SchedulePage />} />
              <Route path="/concierge" element={<ConciergePage />} />
              <Route path="/swo" element={<SwoListPage />} />
              <Route path="/swo/:id" element={<SwoHubPage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/purchasing/vendors" element={<VendorsPage />} />
              <Route path="/purchasing/vendors/:id" element={<VendorDetailPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/count" element={<CycleCountPage />} />
              <Route path="/inventory/reports" element={<InventoryReportsPage />} />
              <Route path="/labels" element={<LabelsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/integrations/quickbooks" element={<QboSetupPage />} />
              {/* WatchM8 lives under Setup so the owner-only prod rule inherits from the Setup tree (MH 2026-10-03); the old path redirects. */}
              <Route path="/setup/integrations/watchm8" element={<Wm8SetupPage />} />
              <Route path="/integrations/watchm8" element={<Navigate to="/setup/integrations/watchm8" replace />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/sales" element={<SalesOrdersPage />} />
              <Route path="/sales/new" element={<SalesOrderDetailPage />} />
              <Route path="/sales/pickup" element={<PickupStationPage />} />
              <Route path="/sales/ship" element={<ShipStationPage />} />
              <Route path="/shipping/inbound" element={<InboundShippingPage />} />
              <Route path="/shipping/bill-audit" element={<BillAuditPage />} />
              <Route path="/sales/:id" element={<SalesOrderDetailPage />} />
              <Route path="/actions/ship" element={<Navigate to="/sales/ship" replace />} />
              <Route path="/actions/pickup" element={<Navigate to="/sales/pickup" replace />} />
              <Route path="/actions/:action" element={<ActionPlaceholder />} />
              {PLACEHOLDER_PATHS.map((p) => (
                <Route key={p} path={p} element={<SectionPlaceholder />} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
