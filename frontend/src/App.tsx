import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ToastHost, toast } from '@/components/ui/Toast';
import { desktopAllowed, padAllowed, roleKind, rwAllowed, ROLE_HOME, ROLE_LABEL, type RoleKind } from '@/config/roles';
import AppShell from '@/components/layout/AppShell';
import IntakeLayout from '@/components/intake/IntakeLayout';
import { canAccess, findNavItem } from '@/config/navigation';
import AuditLogPage from '@/pages/AuditLogPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import Client360Page from '@/pages/clients/Client360Page';
import InboxPage from '@/pages/InboxPage';
import RcShell from '@/rc/RcShell';
import RgShell from '@/pages/rg/RgShell';
import RwShell, { RwRestricted } from '@/pages/rw/RwShell';
import RwJobsPage from '@/pages/rw/RwJobsPage';
import RwJobPage from '@/pages/rw/RwJobPage';
import RwPartsPage from '@/pages/rw/RwPartsPage';
import RwQcPage from '@/pages/rw/RwQcPage';
import RwEvidencePage from '@/pages/rw/RwEvidencePage';
import RwFloorPage from '@/pages/rw/RwFloorPage';
import AssignMovePage from '@/pages/rw/AssignMovePage';
import CustodyPage from '@/pages/rw/CustodyPage';
import CallsPage from '@/pages/rs/CallsPage';
import PartsPage from '@/pages/rs/PartsPage';
import ApprovalsToSendPage from '@/pages/rs/ApprovalsToSendPage';
import HitlistPage from '@/pages/rs/HitlistPage';
import RwBulkAssignPage from '@/pages/rw/RwBulkAssignPage';
import RwWorkQueuePage from '@/pages/rw/RwWorkQueuePage';
import RwWmPage from '@/pages/rw/RwWmPage';
import RwStationScanPage from '@/pages/rw/RwStationScanPage';
import RwPadPage from '@/pages/rw/RwPadPage';
import RwBenchPage from '@/pages/rw/RwBenchPage';
import RwPickingPage from '@/pages/rw/RwPickingPage';
import RwHistoryPage from '@/pages/rw/RwHistoryPage';
import RwDevicePage from '@/pages/rw/RwDevicePage';
import RwConciergePage from '@/pages/rw/RwConciergePage';
import RwReportsPage from '@/pages/rw/RwReportsPage';
import AllJobsPage from '@/pages/jobs/AllJobsPage';
import { IntakeAwaitingApprovalPage, IntakeInspectionFormStep, IntakeInspectionListPage, IntakePhotosPage } from '@/pages/intake/IntakeStepPages';
import RcInspectionFormPage from '@/pages/rc/RcInspectionFormPage';
import QboSetupPage from '@/pages/rs/QboSetupPage';
import RgHomePage from '@/pages/rg/RgHomePage';
import RgClockPage from '@/pages/rg/RgClockPage';
import RgManagerPage from '@/pages/rg/RgManagerPage';
import RgWeekPage from '@/pages/rg/RgWeekPage';
import RgKioskPage from '@/pages/rg/RgKioskPage';
import KioskPage from '@/pages/kiosk/KioskPage';
import WmKioskPage from '@/pages/kiosk/WmKioskPage';
import PayPage from '@/pages/PayPage';
import RequestsPage from '@/pages/RequestsPage';
import RwTestingQueuePage from '@/pages/rw/testing/RwTestingQueuePage';
import RwTestingTestPage from '@/pages/rw/testing/RwTestingTestPage';
import RcLoginPage from '@/pages/rc/RcLoginPage';
import RcSignupPage from '@/pages/rc/RcSignupPage';
import RcAccountPage from '@/pages/rc/RcAccountPage';
import RcHomePage from '@/pages/rc/RcHomePage';
import RcEstimatePage from '@/pages/rc/RcEstimatePage';
import RcInvoicePage from '@/pages/rc/RcInvoicePage';
import RcWatchPage from '@/pages/rc/RcWatchPage';
import RcPartsPage from '@/pages/rc/RcPartsPage';
import RcReportPage from '@/pages/rc/RcReportPage';
import RcMessagesPage from '@/pages/rc/RcMessagesPage';
import RcNotFound from '@/pages/rc/RcNotFound';
import Dashboard from '@/pages/Dashboard';
import EstimateCreatePage from '@/pages/estimates/EstimateCreatePage';
import EstimateDetailPage from '@/pages/estimates/EstimateDetailPage';
import EstimatesListPage from '@/pages/estimates/EstimatesListPage';
import PersonHitlistPage, { HitlistIndex, HomeRedirect } from '@/pages/hitlist/PersonHitlistPage';
import TeamHitlistPage from '@/pages/hitlist/TeamHitlistPage';
import AppraisalPage from '@/pages/jobs/AppraisalPage';
import ArrivalPage from '@/pages/intake/ArrivalPage';
import LabelQueuePage from '@/pages/intake/LabelQueuePage';
import SentPage from '@/pages/intake/SentPage';
import ReceivePackageListPage from '@/pages/intake/ReceivePackageListPage';
import ReceivePackagePage from '@/pages/intake/ReceivePackagePage';
import ReceiveWatchListPage from '@/pages/intake/ReceiveWatchListPage';
import ReceiveWatchPage from '@/pages/intake/ReceiveWatchPage';
import WatchIntakeHistoryPage from '@/pages/intake/WatchIntakeHistoryPage';
import WorkOrderPage from '@/pages/intake/WorkOrderPage';
import TradeScanInPage from '@/pages/intake/TradeScanInPage';
import JobsPage from '@/pages/JobsPage';
import JobCreatePage from '@/pages/jobs/JobCreatePage';
import JobDetailPage from '@/pages/jobs/JobDetailPage';
import ShopTimePage from '@/pages/jobs/ShopTimePage';
import SalesOrdersPage from '@/pages/sales/SalesOrdersPage';
import SalesOrderDetailPage from '@/pages/sales/SalesOrderDetailPage';
import PickupStationPage from '@/pages/sales/PickupStationPage';
import ShipStationPage from '@/pages/sales/ShipStationPage';
import InboundShippingPage from '@/pages/shipping/InboundShippingPage';
import BillAuditPage from '@/pages/shipping/BillAuditPage';
import BenchPage from '@/pages/workshop/BenchPage';
import SupervisorPage from '@/pages/workshop/SupervisorPage';
import FloorMapPage from '@/pages/workshop/FloorMapPage';
import PartsKnowledgePage from '@/pages/workshop/PartsKnowledgePage';
import { ActionPlaceholder, NotFound, RestrictedPage, SectionPlaceholder } from '@/pages/Placeholders';
import SetupPage from '@/pages/SetupPage';
import ConciergePage from '@/pages/rs/ConciergePage';
import SwoListPage from '@/pages/rs/SwoPage';
import SwoHubPage from '@/pages/rs/SwoHubPage';
import RwMessagesPage from '@/pages/rw/RwMessagesPage';
import RwInspectPage from '@/pages/rw/RwInspectPage';
import InspectionSetupPage from '@/pages/setup/InspectionSetupPage';
import AccessControlPage from '@/pages/rs/AccessControlPage';
import PurchasingPage from '@/pages/rs/PurchasingPage';
import VendorsPage, { VendorDetailPage } from '@/pages/rs/VendorsPage';
import SchedulePage from '@/pages/SchedulePage';
import InventoryPage from '@/pages/rs/InventoryPage';
import InventoryReportsPage from '@/pages/rs/InventoryReportsPage';
import '@/api/inventoryReports';
import CycleCountPage from '@/pages/rs/CycleCountPage';
import { AccountingPage, HelpPage, IntegrationsPage, LabelsPage, ReportsPage } from '@/pages/rs/RsPages';
import SignInPage from '@/pages/SignInPage';
import ChooseViewPage from '@/pages/ChooseViewPage';
import { ViewAsBanner } from '@/components/layout/ViewAs';
import StationSetupPage from '@/pages/StationSetupPage';

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
          {/* E13 — RGTime phone time-clock (own remembered session) and the public walk-in kiosk (no session, no chrome) */}
          <Route path="/rg/kiosk" element={<RgKioskPage />} />
          <Route path="/rg" element={<RgShell />}>
            <Route index element={<RgHomePage />} />
            <Route path="clock" element={<RgClockPage />} />
            <Route path="week" element={<RgWeekPage />} />
            <Route path="manager" element={<RgManagerPage />} />
          </Route>
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/pay/:token" element={<PayPage />} />
          <Route path="/rc" element={<RcShell />}>
            <Route index element={<RcLoginPage />} />
            <Route path="signup" element={<RcSignupPage />} />
            <Route path="account" element={<RcAccountPage />} />
            <Route path="auth/:token" element={<Navigate to="/rc" replace />} />
            <Route path="home" element={<RcHomePage />} />
            <Route path="estimates/:id" element={<RcEstimatePage />} />
            <Route path="invoices/:id" element={<RcInvoicePage />} />
            <Route path="watches/:id" element={<RcWatchPage />} />
            <Route path="parts/:id" element={<RcPartsPage />} />
            <Route path="report/:token" element={<RcReportPage />} />
            <Route path="inspection/:token" element={<RcInspectionFormPage />} />
            <Route path="messages" element={<RcMessagesPage />} />
            <Route path="*" element={<RcNotFound />} />
          </Route>
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
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<Client360Page />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/setup/access" element={<AccessControlPage />} />
              <Route path="/setup/inspection" element={<InspectionSetupPage />} />
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
