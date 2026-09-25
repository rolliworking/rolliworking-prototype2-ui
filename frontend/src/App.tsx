import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import AppShell from '@/components/layout/AppShell';
import IntakeLayout from '@/components/intake/IntakeLayout';
import { findNavItem } from '@/config/navigation';
import AuditLogPage from '@/pages/AuditLogPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import Client360Page from '@/pages/clients/Client360Page';
import InboxPage from '@/pages/InboxPage';
import RcShell from '@/rc/RcShell';
import RtShell from '@/pages/rt/RtShell';
import RtQueuePage from '@/pages/rt/RtQueuePage';
import RtTestPage from '@/pages/rt/RtTestPage';
import RcLoginPage from '@/pages/rc/RcLoginPage';
import RcAuthPage from '@/pages/rc/RcAuthPage';
import RcHomePage from '@/pages/rc/RcHomePage';
import RcEstimatePage from '@/pages/rc/RcEstimatePage';
import RcInvoicePage from '@/pages/rc/RcInvoicePage';
import RcWatchPage from '@/pages/rc/RcWatchPage';
import RcReportPage from '@/pages/rc/RcReportPage';
import RcMessagesPage from '@/pages/rc/RcMessagesPage';
import RcNotFound from '@/pages/rc/RcNotFound';
import Dashboard from '@/pages/Dashboard';
import EstimateCreatePage from '@/pages/estimates/EstimateCreatePage';
import EstimateDetailPage from '@/pages/estimates/EstimateDetailPage';
import EstimatesListPage from '@/pages/estimates/EstimatesListPage';
import TodayPage from '@/pages/TodayPage';
import ArrivalPage from '@/pages/intake/ArrivalPage';
import LabelQueuePage from '@/pages/intake/LabelQueuePage';
import OutboxPage from '@/pages/intake/OutboxPage';
import ReceivePackageListPage from '@/pages/intake/ReceivePackageListPage';
import ReceivePackagePage from '@/pages/intake/ReceivePackagePage';
import ReceiveWatchListPage from '@/pages/intake/ReceiveWatchListPage';
import ReceiveWatchPage from '@/pages/intake/ReceiveWatchPage';
import WorkOrderPage from '@/pages/intake/WorkOrderPage';
import JobsPage from '@/pages/JobsPage';
import JobCreatePage from '@/pages/jobs/JobCreatePage';
import JobDetailPage from '@/pages/jobs/JobDetailPage';
import ShopTimePage from '@/pages/jobs/ShopTimePage';
import SalesOrdersPage from '@/pages/sales/SalesOrdersPage';
import SalesOrderDetailPage from '@/pages/sales/SalesOrderDetailPage';
import PickupStationPage from '@/pages/sales/PickupStationPage';
import ShipStationPage from '@/pages/sales/ShipStationPage';
import BenchPage from '@/pages/workshop/BenchPage';
import SupervisorPage from '@/pages/workshop/SupervisorPage';
import FloorMapPage from '@/pages/workshop/FloorMapPage';
import PartsKnowledgePage from '@/pages/workshop/PartsKnowledgePage';
import { ActionPlaceholder, NotFound, RestrictedPage, SectionPlaceholder } from '@/pages/Placeholders';
import SetupPage from '@/pages/SetupPage';
import PurchasingPage from '@/pages/rs/PurchasingPage';
import InventoryPage from '@/pages/rs/InventoryPage';
import { AccountingPage, HelpPage, IntegrationsPage, LabelsPage, ReportsPage } from '@/pages/rs/RsPages';
import SignInPage from '@/pages/SignInPage';
import StationSetupPage from '@/pages/StationSetupPage';

function RequireAuth() {
  const { user, station, loading } = useAuth();
  if (loading) return null;
  if (!station) return <Navigate to="/station-setup" replace />;
  if (!user) return <Navigate to="/sign-in" replace />;
  return <AppShell />;
}

function TierGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  if (item && !item.tiers.includes(user!.accessTier)) return <RestrictedPage label={item.label} />;
  return <Outlet />;
}

const PLACEHOLDER_PATHS = ['/inspection-photos'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/station-setup" element={<StationSetupPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          {/* RolliConnect — client portal. Separate shell, separate session, no staff routes reachable. */}
          <Route path="/rt" element={<RtShell />}>
            <Route index element={<RtQueuePage />} />
            <Route path="test/:jobId" element={<RtTestPage />} />
          </Route>
          <Route path="/rc" element={<RcShell />}>
            <Route index element={<RcLoginPage />} />
            <Route path="auth/:token" element={<RcAuthPage />} />
            <Route path="home" element={<RcHomePage />} />
            <Route path="estimates/:id" element={<RcEstimatePage />} />
            <Route path="invoices/:id" element={<RcInvoicePage />} />
            <Route path="watches/:id" element={<RcWatchPage />} />
            <Route path="report/:token" element={<RcReportPage />} />
            <Route path="messages" element={<RcMessagesPage />} />
            <Route path="*" element={<RcNotFound />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<TierGate />}>
              <Route index element={<Dashboard />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/hit-list" element={<Navigate to="/today" replace />} />
              <Route path="/estimates" element={<EstimatesListPage />} />
              <Route path="/estimates/new" element={<EstimateCreatePage />} />
              <Route path="/estimates/:id" element={<EstimateDetailPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/new" element={<JobCreatePage />} />
              <Route path="/jobs/shop-time" element={<ShopTimePage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/intake" element={<IntakeLayout />}>
                <Route index element={<ArrivalPage />} />
                <Route path="receive" element={<ReceivePackageListPage />} />
                <Route path="receive/:id" element={<ReceivePackagePage />} />
                <Route path="work-order" element={<WorkOrderPage />} />
                <Route path="inspection" element={<ReceiveWatchListPage />} />
                <Route path="inspection/:id" element={<ReceiveWatchPage />} />
                <Route path="outbox" element={<OutboxPage />} />
                <Route path="labels" element={<LabelQueuePage />} />
              </Route>
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<Client360Page />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/setup/audit-log" element={<AuditLogPage />} />
              <Route path="/bench" element={<BenchPage />} />
              <Route path="/supervisor" element={<SupervisorPage />} />
              <Route path="/floor" element={<FloorMapPage />} />
              <Route path="/parts/knowledge" element={<PartsKnowledgePage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/labels" element={<LabelsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/sales" element={<SalesOrdersPage />} />
              <Route path="/sales/new" element={<SalesOrderDetailPage />} />
              <Route path="/sales/pickup" element={<PickupStationPage />} />
              <Route path="/sales/ship" element={<ShipStationPage />} />
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
