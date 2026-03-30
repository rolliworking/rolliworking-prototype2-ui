import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import UsersPage from "./pages/setup/UsersPage";
import DashboardNew from "./pages/DashboardNew";
import PartsPage from "./pages/inventory/PartsPage";
import FishbowlImportPage from "./pages/inventory/FishbowlImportPage";
import InventoryQtyImportPage from "./pages/inventory/InventoryQtyImportPage";
import RetailPricingImportPage from "./pages/inventory/RetailPricingImportPage";
import ClientPropertyPage from "./pages/inventory/ClientPropertyPage";
import CalibersPage from "./pages/inventory/CalibersPage";
import ReorderAlertsPage from "./pages/inventory/ReorderAlertsPage";
import CycleCountPage from "./pages/inventory/CycleCountPage";
import CycleCountScannerPage from "./pages/inventory/CycleCountScannerPage";
import QuickMovePage from "./pages/inventory/QuickMovePage";
import VendorsPage from "./pages/purchasing/VendorsPage";
import VendorImportPage from "./pages/purchasing/VendorImportPage";
import PurchaseOrdersPage from "./pages/purchasing/PurchaseOrdersPage";
import DisassemblyOrdersPage from "./pages/purchasing/DisassemblyOrdersPage";
import SalesOrdersPage from "./pages/sales/SalesOrdersPage";
import SalesOrderDetailPage from "./pages/sales/SalesOrderDetailPage";
import SalesOrderFulfillPage from "./pages/sales/SalesOrderFulfillPage";
import EstimatesPage from "./pages/estimates/EstimatesPage";
import CreateEstimatePage from "./pages/estimates/CreateEstimatePage";
import EstimateDetailPage from "./pages/estimates/EstimateDetailPage";
import CustomersPage from "./pages/estimates/CustomersPage";
import CustomerDetailPage from "./pages/estimates/CustomerDetailPage";
import EstimateTemplatesPage from "./pages/estimates/EstimateTemplatesPage";
import WaitlistPage from "./pages/estimates/WaitlistPage";
import ShopTimePage from "./pages/jobs/ShopTimePage";
import EmailTemplatesPage from "./pages/setup/EmailTemplatesPage";
import ProductsServicesPage from "./pages/setup/ProductsServicesPage";
import QBOImportPage from "./pages/setup/QBOImportPage";
import QBOCustomerSyncPage from "./pages/setup/QBOCustomerSyncPage";
import QBOEstimateSyncPage from "./pages/setup/QBOEstimateSyncPage";
import QBOSyncStatusPage from "./pages/setup/QBOSyncStatusPage";
import QBOAccountMappingsPage from "./pages/setup/QBOAccountMappingsPage";
import QBOInvoiceSyncPage from "./pages/setup/QBOInvoiceSyncPage";
import SecuritySettingsPage from "./pages/setup/SecuritySettingsPage";
import CompanySettingsPage from "./pages/setup/CompanySettingsPage";
import LabelsPage from "./pages/Labels2Page";
import IntakeLeadsPage from "./pages/intake/IntakeLeadsPage";
import IntakeEmailPage from "./pages/intake/IntakeEmailPage";
import InspectionsPage from "./pages/intake/InspectionsPage";
import ClientWatchEntryPage from "./pages/intake/ClientWatchEntryPage";
import ReceivePackagesPage from "./pages/intake/ReceivePackagesPage";
import ShippingLabelRequestsPage from "./pages/intake/ShippingLabelRequestsPage";
import EulaPage from "./pages/legal/EulaPage";
import AppraisalsPage from "./pages/reports/AppraisalsPage";
import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import AnalyticsPage from "./pages/reports/AnalyticsPage";
import BandEstimatesFunnelPage from "./pages/reports/BandEstimatesFunnelPage";
import RequestShippingLabelPage from "./pages/public/RequestShippingLabelPage";
import DocumentationPage from "./pages/help/DocumentationPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* App routes with sidebar layout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardNew />} />
              <Route path="/estimates" element={<EstimatesPage />} />
              <Route path="/estimates/new" element={<CreateEstimatePage />} />
              <Route path="/estimates/templates" element={<EstimateTemplatesPage />} />
              <Route path="/estimates/email-templates" element={<EmailTemplatesPage />} />
              <Route path="/estimates/waitlist" element={<WaitlistPage />} />
              <Route path="/estimates/:id" element={<EstimateDetailPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/inventory/parts" element={<PartsPage />} />
              <Route path="/inventory/parts/import" element={<FishbowlImportPage />} />
              <Route path="/inventory/parts/import-qty" element={<InventoryQtyImportPage />} />
              <Route path="/inventory/parts/import-pricing" element={<RetailPricingImportPage />} />
              <Route path="/inventory/calibers" element={<CalibersPage />} />
              <Route path="/inventory/reorder-alerts" element={<ReorderAlertsPage />} />
              <Route path="/inventory/client-property" element={<ClientPropertyPage />} />
              <Route path="/inventory/cycle-count" element={<CycleCountPage />} />
              <Route path="/inventory/cycle-count/:countId/scan" element={<CycleCountScannerPage />} />
              <Route path="/inventory/quick-move" element={<QuickMovePage />} />
              <Route path="/inventory/transfers" element={<div className="p-6"><h1 className="text-2xl font-serif">Inventory Transfers</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/inventory/products" element={<ProductsServicesPage />} />
              <Route path="/inventory/products/import" element={<QBOImportPage />} />
              <Route path="/sales/orders" element={<SalesOrdersPage />} />
              <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
              <Route path="/sales/orders/:id/fulfill" element={<SalesOrderFulfillPage />} />
              <Route path="/purchasing/orders" element={<PurchaseOrdersPage />} />
              <Route path="/purchasing/vendors" element={<VendorsPage />} />
              <Route path="/purchasing/vendors/import" element={<VendorImportPage />} />
              <Route path="/purchasing/disassembly" element={<DisassemblyOrdersPage />} />
              <Route path="/purchasing/receiving" element={<div className="p-6"><h1 className="text-2xl font-serif">Receiving</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/jobs/shop-time" element={<ShopTimePage />} />
              <Route path="/intake/leads" element={<IntakeLeadsPage />} />
              <Route path="/intake/email" element={<IntakeEmailPage />} />
              <Route path="/intake/inspections" element={<InspectionsPage />} />
              <Route path="/intake/receive-watch" element={<ClientWatchEntryPage />} />
              <Route path="/intake/receive-packages" element={<ReceivePackagesPage />} />
              <Route path="/intake/shipping-labels" element={<ShippingLabelRequestsPage />} />
              <Route path="/reports/analytics" element={<AnalyticsPage />} />
              <Route path="/reports/appraisals" element={<AppraisalsPage />} />
              <Route path="/reports/band-funnel" element={<BandEstimatesFunnelPage />} />
              <Route path="/reports/inventory" element={<div className="p-6"><h1 className="text-2xl font-serif">Inventory Reports</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/reports/transactions" element={<div className="p-6"><h1 className="text-2xl font-serif">Transaction Reports</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/accounting" element={<div className="p-6"><h1 className="text-2xl font-serif">Accounting</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/setup/locations" element={<div className="p-6"><h1 className="text-2xl font-serif">Stores & Locations</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/setup/users" element={<UsersPage />} />
              <Route path="/setup/email-templates" element={<EmailTemplatesPage />} />
              <Route path="/setup/qbo-customers" element={<QBOCustomerSyncPage />} />
              <Route path="/setup/qbo-estimates" element={<QBOEstimateSyncPage />} />
              <Route path="/setup/qbo-status" element={<QBOSyncStatusPage />} />
              <Route path="/setup/qbo-invoices" element={<QBOInvoiceSyncPage />} />
              <Route path="/setup/qbo-accounts" element={<QBOAccountMappingsPage />} />
              <Route path="/setup/settings" element={<div className="p-6"><h1 className="text-2xl font-serif">Settings</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/setup/security" element={<SecuritySettingsPage />} />
              <Route path="/setup/company" element={<CompanySettingsPage />} />
              <Route path="/integrations" element={<div className="p-6"><h1 className="text-2xl font-serif">Integrations</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/labels" element={<LabelsPage />} />
              <Route path="/help/docs" element={<DocumentationPage />} />
            </Route>
            
            {/* Public legal pages */}
            <Route path="/legal/eula" element={<EulaPage />} />
            <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
            
            {/* Public customer request pages */}
            <Route path="/request-label/:estimateId" element={<RequestShippingLabelPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
