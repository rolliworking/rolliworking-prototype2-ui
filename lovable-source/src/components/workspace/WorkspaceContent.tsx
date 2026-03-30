import { useWorkspace } from '@/contexts/WorkspaceContext';
import { PurchaseOrderForm } from '@/components/purchasing/PurchaseOrderForm';
import { PurchaseOrdersList } from '@/components/purchasing/PurchaseOrdersList';
import { VendorsList } from '@/components/purchasing/VendorsList';
import { PartsListTab } from '@/components/workspace/PartsListTab';
import { CustomersListTab } from '@/components/workspace/CustomersListTab';
import { DashboardTab } from '@/components/workspace/DashboardTab';
import { VendorDraftsTab } from '@/components/workspace/VendorDraftsTab';
import { ReorderDraftsTab } from '@/components/workspace/ReorderDraftsTab';
import EmailTemplatesPage from '@/pages/setup/EmailTemplatesPage';
import AnalyticsPage from '@/pages/reports/AnalyticsPage';
import BandEstimatesFunnelPage from '@/pages/reports/BandEstimatesFunnelPage';
import SalesOrdersPage from '@/pages/sales/SalesOrdersPage';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface WorkspaceContentProps {
  className?: string;
}

export function WorkspaceContent({ className }: WorkspaceContentProps) {
  const { tabs, activeTabId } = useWorkspace();
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  
  if (!activeTab) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-muted/20', className)}>
        <div className="text-center text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No document open</p>
          <p className="text-sm">Select an item from the sidebar or create a new document</p>
        </div>
      </div>
    );
  }

  // Render the appropriate component based on tab type
  switch (activeTab.type) {
    case 'new-po':
    case 'po':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <PurchaseOrderForm 
            tabId={activeTab.id}
            poId={activeTab.recordId}
          />
        </div>
      );
    
    case 'po-list':
    case 'po-draft':
    case 'po-issued':
    case 'po-received':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <PurchaseOrdersList 
            filter={
              activeTab.type === 'po-draft' ? 'draft' :
              activeTab.type === 'po-issued' ? 'issued' :
              activeTab.type === 'po-received' ? 'received' : 
              undefined
            }
          />
        </div>
      );

    case 'vendors-list':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <VendorsList />
        </div>
      );

    case 'parts-list':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <PartsListTab />
        </div>
      );

    case 'customers-list':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <CustomersListTab />
        </div>
      );

    case 'dashboard':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <DashboardTab />
        </div>
      );

    case 'vendor-drafts':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <VendorDraftsTab />
        </div>
      );

    case 'reorder-drafts':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <ReorderDraftsTab />
        </div>
      );

    case 'email-templates':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <EmailTemplatesPage />
        </div>
      );

    case 'analytics':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <AnalyticsPage />
        </div>
      );

    case 'band-funnel':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <BandEstimatesFunnelPage />
        </div>
      );

    case 'sales-orders':
      return (
        <div className={cn('h-full overflow-auto', className)}>
          <SalesOrdersPage />
        </div>
      );

    default:
      return (
        <div className={cn('flex items-center justify-center h-full bg-muted/20', className)}>
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Content coming soon</p>
            <p className="text-sm">Tab type: {activeTab.type}</p>
          </div>
        </div>
      );
  }
}
