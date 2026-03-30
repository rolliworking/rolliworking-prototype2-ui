import { useWorkspace, WorkspaceTab, TabType } from '@/contexts/WorkspaceContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import {
  X,
  ClipboardList,
  Users,
  Building2,
  Box,
  FileText,
  Plus,
  Home,
  BarChart3,
  Settings,
  FolderOpen,
} from 'lucide-react';

const TAB_ICONS: Record<string, React.ElementType> = {
  'dashboard': Home,
  'customers-list': Users,
  'vendors-list': Building2,
  'parts-list': Box,
  'po-list': ClipboardList,
  'po-draft': ClipboardList,
  'po-issued': ClipboardList,
  'po-received': ClipboardList,
  'customer': Users,
  'vendor': Building2,
  'part': Box,
  'po': ClipboardList,
  'new-po': Plus,
  'new-customer': Plus,
  'new-vendor': Plus,
  'new-part': Plus,
  'estimates-list': FileText,
  'estimate': FileText,
  'new-estimate': Plus,
  'reports': BarChart3,
  'settings': Settings,
  'saved-pos': ClipboardList,
  'vendor-drafts': Building2,
  'reorder-drafts': ClipboardList,
  'job-templates': FolderOpen,
  'email-templates': FileText,
  // Intake tabs
  'intake-leads': ClipboardList,
  'intake-email': FileText,
  'intake-inspections': ClipboardList,
  'intake-receive': Box,
  // Inventory tabs
  'calibers': Settings,
  'reorder-alerts': ClipboardList,
  'cycle-count': Box,
  'quick-move': Box,
  'client-property': Box,
  'products-services': Box,
  // Purchasing tabs
  'disassembly-orders': ClipboardList,
  'receiving': ClipboardList,
  // Sales tabs
  'sales-orders': ClipboardList,
  // Estimates tabs
  'waitlist': ClipboardList,
  // Reports tabs
  'analytics': BarChart3,
  'band-funnel': BarChart3,
  'inventory-report': BarChart3,
  'transactions-report': FileText,
};

// Map tab types to routes
const TAB_ROUTES: Record<TabType, string | ((recordId?: string) => string)> = {
  'dashboard': '/dashboard',
  'customers-list': '/customers',
  'vendors-list': '/purchasing/vendors',
  'parts-list': '/inventory/parts',
  'po-list': '/purchasing/orders',
  'po-draft': '/purchasing/drafts',
  'po-issued': '/purchasing/issued',
  'po-received': '/purchasing/receiving',
  'customer': (id) => `/customers/${id}`,
  'vendor': (id) => `/purchasing/vendors/${id}`,
  'part': (id) => `/inventory/parts/${id}`,
  'po': (id) => `/purchasing/orders/${id}`,
  'new-po': '/purchasing/orders/new',
  'new-customer': '/customers/new',
  'new-vendor': '/purchasing/vendors/new',
  'new-part': '/inventory/parts/new',
  'estimates-list': '/estimates',
  'estimate': (id) => `/estimates/${id}`,
  'new-estimate': '/estimates/new',
  'reports': '/reports',
  'settings': '/setup/settings',
  'saved-pos': '/purchasing/saved',
  'vendor-drafts': '/purchasing/vendor-drafts',
  'reorder-drafts': '/purchasing/reorder-drafts',
  'job-templates': '/estimates/templates',
  'email-templates': '/estimates/email-templates',
  // Intake tabs
  'intake-leads': '/intake/leads',
  'intake-email': '/intake/email',
  'intake-inspections': '/intake/inspections',
  'intake-receive': '/intake/receive-watch',
  // Inventory tabs
  'calibers': '/inventory/calibers',
  'reorder-alerts': '/inventory/reorder-alerts',
  'cycle-count': '/inventory/cycle-count',
  'quick-move': '/inventory/quick-move',
  'client-property': '/inventory/client-property',
  'products-services': '/inventory/products',
  // Purchasing tabs
  'disassembly-orders': '/purchasing/disassembly',
  'receiving': '/purchasing/receiving',
  // Sales tabs
  'sales-orders': '/sales/orders',
  // Estimates tabs
  'waitlist': '/estimates/waitlist',
  // Reports tabs
  'analytics': '/reports/analytics',
  'band-funnel': '/reports/band-funnel',
  'inventory-report': '/reports/inventory',
  'transactions-report': '/reports/transactions',
};

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const { 
    tabs, 
    activeTabId, 
    setActiveTab, 
    closeTab,
    pendingClose,
    confirmPendingClose,
    cancelPendingClose,
  } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [closingTab, setClosingTab] = useState<WorkspaceTab | null>(null);

  const getTabRoute = (tab: WorkspaceTab): string => {
    const route = TAB_ROUTES[tab.type];
    if (typeof route === 'function') {
      return route(tab.recordId);
    }
    return route;
  };

  const handleTabClick = (tab: WorkspaceTab) => {
    setActiveTab(tab.id);
    const route = getTabRoute(tab);
    if (location.pathname !== route) {
      navigate(route);
    }
  };

  const handleCloseTab = (tab: WorkspaceTab, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.isDirty) {
      setClosingTab(tab);
    } else {
      closeTab(tab.id);
    }
  };

  const confirmClose = () => {
    if (closingTab) {
      closeTab(closingTab.id);
      setClosingTab(null);
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn('border-b bg-muted/30', className)}>
        <ScrollArea className="w-full">
          <div className="flex h-10 items-center gap-0.5 px-2">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.type] || FileText;
              const isActive = tab.id === activeTabId;
              
              return (
                <div
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={cn(
                    'group flex items-center gap-2 h-8 px-3 rounded-t-md cursor-pointer transition-colors border-b-2 min-w-[120px] max-w-[200px]',
                    isActive
                      ? 'bg-background border-b-primary text-foreground'
                      : 'bg-muted/50 border-b-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {tab.isDirty && <span className="text-destructive mr-1">•</span>}
                    {tab.title}
                  </span>
                  <button
                    onClick={(e) => handleCloseTab(tab, e)}
                    className={cn(
                      'h-4 w-4 rounded-sm flex items-center justify-center shrink-0',
                      'opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20',
                      isActive && 'opacity-60'
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Manual close confirmation dialog */}
      <AlertDialog open={!!closingTab} onOpenChange={(open) => !open && setClosingTab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in "{closingTab?.title}". Are you sure you want to close this tab? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground">
              Close Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-close oldest tab confirmation dialog */}
      <AlertDialog open={!!pendingClose} onOpenChange={(open) => !open && cancelPendingClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tab Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You have 5 tabs open. Opening a new tab will close "{pendingClose?.tabToClose.title}" which has unsaved changes. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPendingClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingClose} className="bg-destructive text-destructive-foreground">
              Close & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}