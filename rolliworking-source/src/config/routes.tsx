import { lazy, Suspense, ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { useUserRole } from "@/hooks/use-user-role";

// Lazy load pages for better code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const WorkQueue = lazy(() => import("@/pages/WorkQueue"));
const Customers = lazy(() => import("@/pages/Customers"));
const NewCustomer = lazy(() => import("@/pages/NewCustomer"));
const NewInspection = lazy(() => import("@/pages/NewInspection"));
const NewJob = lazy(() => import("@/pages/NewJob"));
const PartsRequest = lazy(() => import("@/pages/PartsRequest"));
const PartsRequestHistory = lazy(() => import("@/pages/PartsRequestHistory"));
const History = lazy(() => import("@/pages/History"));
const Reports = lazy(() => import("@/pages/Reports"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const StatusChangesReport = lazy(() => import("@/pages/StatusChangesReport"));
const EmailTemplates = lazy(() => import("@/pages/EmailTemplates"));
const LiabilityWaiver = lazy(() => import("@/pages/LiabilityWaiver"));
const WaiverHistory = lazy(() => import("@/pages/WaiverHistory"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const Watchmakers = lazy(() => import("@/pages/Watchmakers"));
const DataManagement = lazy(() => import("@/pages/DataManagement"));
const MovementPerformance = lazy(() => import("@/pages/MovementPerformance"));
const WatchmakerActivity = lazy(() => import("@/pages/WatchmakerActivity"));
const HtmlEmailMockup = lazy(() => import("@/pages/HtmlEmailMockup"));
const DailyHitList = lazy(() => import("@/pages/DailyHitList"));
const WeeklyWatchmakerReport = lazy(() => import("@/pages/WeeklyWatchmakerReport"));
const InspectionScantron = lazy(() => import("@/pages/InspectionScantron"));
const ViewApproval = lazy(() => import("@/pages/ViewApproval"));
const Wiki = lazy(() => import("@/pages/Wiki"));
const StationScanner = lazy(() => import("@/pages/StationScanner"));
const ClientReplies = lazy(() => import("@/pages/ClientReplies"));
const BandWorkQueue = lazy(() => import("@/pages/BandWorkQueue"));

/** Redirects staff users to /parts-history, others to /work-queue */
function HomeRedirect() {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return null;
  if (role === "staff") return <Navigate to="/parts-history" replace />;
  return <WorkQueue />;
}

export interface RouteConfig {
  path: string;
  component: ComponentType;
  permission: string;
}

// All protected routes with their permissions
export const protectedRoutes: RouteConfig[] = [
  { path: "/", component: HomeRedirect, permission: "jobs.view" },
  { path: "/work-queue", component: WorkQueue, permission: "jobs.view" },
  { path: "/clients", component: Customers, permission: "customers.view" },
  { path: "/clients/new", component: NewCustomer, permission: "customers.create" },
  { path: "/inspections/new", component: NewInspection, permission: "inspections.view" },
  { path: "/new-job", component: NewJob, permission: "jobs.create" },
  { path: "/parts-request", component: PartsRequest, permission: "parts.view" },
  { path: "/parts-history", component: PartsRequestHistory, permission: "parts_history.view" },
  { path: "/history", component: History, permission: "history.view" },
  { path: "/reports", component: Reports, permission: "reports.view" },
  { path: "/analytics", component: Analytics, permission: "reports.view" },
  { path: "/analytics/status-changes", component: StatusChangesReport, permission: "reports.view" },
  { path: "/email-templates", component: EmailTemplates, permission: "email_templates.view" },
  { path: "/liability-waiver", component: LiabilityWaiver, permission: "waivers.view" },
  { path: "/waiver-history", component: WaiverHistory, permission: "waivers.view" },
  { path: "/users", component: UsersPage, permission: "users.manage" },
  { path: "/audit-logs", component: AuditLogs, permission: "users.manage" },
  { path: "/watchmakers", component: Watchmakers, permission: "users.manage" },
  { path: "/data-management", component: DataManagement, permission: "data.export" },
  { path: "/movement-performance", component: MovementPerformance, permission: "reports.view" },
  { path: "/watchmaker-activity", component: WatchmakerActivity, permission: "reports.view" },
  { path: "/daily-hit-list", component: DailyHitList, permission: "users.manage" },
  { path: "/weekly-watchmaker-report", component: WeeklyWatchmakerReport, permission: "reports.view" },
  { path: "/html-email-mockup", component: HtmlEmailMockup, permission: "inspections.view" },
  { path: "/inspection-scantron", component: InspectionScantron, permission: "inspections.view" },
  { path: "/view-approval", component: ViewApproval, permission: "inspections.view" },
  { path: "/wiki", component: Wiki, permission: "reports.view" },
  { path: "/station-scanner", component: StationScanner, permission: "jobs.view" },
  { path: "/client-replies", component: ClientReplies, permission: "jobs.view" },
  { path: "/follow-up-queue", component: BandWorkQueue, permission: "jobs.view" },
  { path: "/band-work-queue", component: BandWorkQueue, permission: "jobs.view" },
];

// Loading fallback for lazy-loaded routes
function RouteLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Render a protected route with permission check and suspense
export function ProtectedRoute({ route }: { route: RouteConfig }) {
  const Component = route.component;
  return (
    <RequirePermission permission={route.permission}>
      <Suspense fallback={<RouteLoader />}>
        <Component />
      </Suspense>
    </RequirePermission>
  );
}
