import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import AppShell from '@/components/layout/AppShell';
import IntakeLayout from '@/components/intake/IntakeLayout';
import { findNavItem } from '@/config/navigation';
import AuditLogPage from '@/pages/AuditLogPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import Dashboard from '@/pages/Dashboard';
import EstimateCreatePage from '@/pages/estimates/EstimateCreatePage';
import EstimateDetailPage from '@/pages/estimates/EstimateDetailPage';
import EstimatesListPage from '@/pages/estimates/EstimatesListPage';
import HitListPage from '@/pages/HitListPage';
import ArrivalPage from '@/pages/intake/ArrivalPage';
import LabelQueuePage from '@/pages/intake/LabelQueuePage';
import OutboxPage from '@/pages/intake/OutboxPage';
import ReceivePackageListPage from '@/pages/intake/ReceivePackageListPage';
import ReceivePackagePage from '@/pages/intake/ReceivePackagePage';
import ReceiveWatchListPage from '@/pages/intake/ReceiveWatchListPage';
import ReceiveWatchPage from '@/pages/intake/ReceiveWatchPage';
import WorkOrderPage from '@/pages/intake/WorkOrderPage';
import JobsPage from '@/pages/JobsPage';
import { ActionPlaceholder, NotFound, RestrictedPage, SectionPlaceholder } from '@/pages/Placeholders';
import SetupPage from '@/pages/SetupPage';
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

const PLACEHOLDER_PATHS = [
  '/inspection-photos',
  '/sales',
  '/purchasing',
  '/inventory',
  '/labels',
  '/reports',
  '/accounting',
  '/integrations',
  '/help',
];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/station-setup" element={<StationSetupPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<TierGate />}>
              <Route index element={<Dashboard />} />
              <Route path="/hit-list" element={<HitListPage />} />
              <Route path="/estimates" element={<EstimatesListPage />} />
              <Route path="/estimates/new" element={<EstimateCreatePage />} />
              <Route path="/estimates/:id" element={<EstimateDetailPage />} />
              <Route path="/jobs" element={<JobsPage />} />
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
              <Route path="/clients/:id" element={<ClientDetailPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/setup/audit-log" element={<AuditLogPage />} />
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
