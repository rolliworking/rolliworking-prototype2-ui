import { useState, useEffect } from 'react';
import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { TabBar } from '@/components/workspace/TabBar';
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { GlobalSearch } from './GlobalSearch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  ShoppingCart,
  Truck,
  Calculator,
  Settings,
  Link2,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User,
  Loader2,
  Search,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Mail,
  Printer,
  Box,
  FileBarChart,
  Layers,
  BarChart3,
  Users,
  Building2,
  ClipboardList,
  AlertTriangle,
  Settings2,
  ArrowRightLeft,
  ScanBarcode,
  Receipt,
  FileText,
  TrendingUp,
  FolderOpen,
  Zap,
  HelpCircle,
  Sparkles,
  BookOpen,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string; icon?: React.ElementType }[];
  hasCreateMenu?: boolean;
}

const navigation: NavItem[] = [
  {
    label: 'Home',
    icon: ClipboardList,
    href: '/dashboard',
  },
  {
    label: 'Estimates',
    icon: FileText,
    children: [
      { label: 'Requests', href: '/intake/leads', icon: ClipboardList },
      { label: 'All Estimates', href: '/estimates', icon: FileText },
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Waitlist', href: '/estimates/waitlist', icon: Clock },
      { label: 'Job Templates', href: '/estimates/templates', icon: FolderOpen },
      { label: 'Email Templates', href: '/estimates/email-templates', icon: Mail },
    ],
  },
  {
    label: 'Intake',
    icon: Package,
    children: [
      { label: 'Shipping Labels', href: '/intake/shipping-labels', icon: Truck },
      { label: 'Receive Packages', href: '/intake/receive-packages', icon: ScanBarcode },
      { label: 'Email', href: '/intake/email', icon: Mail },
      { label: 'Inspections', href: '/intake/inspections', icon: ClipboardList },
      { label: 'Receive Watch', href: '/intake/receive-watch', icon: Box },
    ],
  },
  {
    label: 'Purchasing',
    icon: Truck,
    children: [
      { label: 'Purchase Orders', href: '/purchasing/orders', icon: ClipboardList },
      { label: 'Draft POs', href: '/purchasing/drafts', icon: ClipboardList },
      { label: 'Issued POs', href: '/purchasing/issued', icon: Truck },
      { label: 'Vendors', href: '/purchasing/vendors', icon: Building2 },
      { label: 'Vendor Drafts', href: '/purchasing/vendor-drafts', icon: Building2 },
      { label: 'Reorder Drafts', href: '/purchasing/reorder-drafts', icon: Zap },
      { label: 'Disassembly Orders', href: '/purchasing/disassembly', icon: Layers },
      { label: 'Receiving', href: '/purchasing/receiving', icon: Truck },
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    children: [
      { label: 'Parts', href: '/inventory/parts', icon: Box },
      { label: 'Products & Services', href: '/inventory/products', icon: Package },
      { label: 'Calibers', href: '/inventory/calibers', icon: Settings2 },
      { label: 'Reorder Alerts', href: '/inventory/reorder-alerts', icon: AlertTriangle },
      { label: 'Cycle Count', href: '/inventory/cycle-count', icon: ScanBarcode },
      { label: 'Quick Move', href: '/inventory/quick-move', icon: ArrowRightLeft },
      { label: 'Client Property', href: '/inventory/client-property', icon: Layers },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    children: [
      { label: 'Sales Orders', href: '/sales/orders', icon: Receipt },
    ],
  },
  {
    label: 'Labels',
    icon: Printer,
    href: '/labels',
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Appraisals', href: '/reports/appraisals', icon: FileText },
      { label: 'Analytics', href: '/reports/analytics', icon: BarChart3 },
      { label: 'Band Estimates Funnel', href: '/reports/band-funnel', icon: TrendingUp },
      { label: 'Inventory Valuation', href: '/reports/inventory', icon: FileBarChart },
      { label: 'Transactions', href: '/reports/transactions', icon: FileText },
    ],
  },
  {
    label: 'Accounting',
    icon: Calculator,
    href: '/accounting',
  },
  {
    label: 'Setup',
    icon: Settings,
    children: [
      { label: 'QBO Account Mappings', href: '/setup/qbo-accounts', icon: Calculator },
      { label: 'QBO Customer Sync', href: '/setup/qbo-customers', icon: Users },
      { label: 'QBO Estimate Sync', href: '/setup/qbo-estimates', icon: FileText },
      { label: 'QBO Invoice Sync', href: '/setup/qbo-invoices', icon: Receipt },
      { label: 'QBO Sync Status', href: '/setup/qbo-status', icon: RefreshCw },
      { label: 'Stores & Locations', href: '/setup/locations', icon: Building2 },
      { label: 'Users & Roles', href: '/setup/users', icon: Users },
      { label: 'Email Templates', href: '/setup/email-templates', icon: Mail },
      { label: 'Security', href: '/setup/security', icon: Settings2 },
      { label: 'Settings', href: '/setup/settings', icon: Settings },
    ],
  },
  {
    label: 'Integrations',
    icon: Link2,
    href: '/integrations',
  },
  {
    label: 'Help',
    icon: HelpCircle,
    children: [
      { label: 'Documentation', href: '/help/docs', icon: BookOpen },
      { label: 'AI Search', href: '/help/ai-search', icon: Sparkles },
    ],
  },
];

function NavItemComponent({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  
  const isActive = item.href 
    ? location.pathname === item.href || location.pathname.startsWith(item.href + '/')
    : item.children?.some(child => location.pathname.startsWith(child.href));

  // Fetch customers for the create menu
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-nav-search', customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, display_name, email')
        .or(`first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,display_name.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: item.hasCreateMenu && customerSearch.length > 0,
  });

  useEffect(() => {
    if (item.children?.some(child => location.pathname.startsWith(child.href))) {
      setIsOpen(true);
    }
  }, [location.pathname, item.children]);

  const handleSelectCustomer = (customerId: string) => {
    setCreateMenuOpen(false);
    setCustomerSearch('');
    navigate(`/estimates/new?customer_id=${customerId}`);
  };

  const handleCreateWithoutCustomer = () => {
    setCreateMenuOpen(false);
    setCustomerSearch('');
    navigate('/estimates/new');
  };

  if (item.children) {
    return (
      <div className="space-y-1">
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'flex-1 flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </>
            )}
          </button>
          {/* Create menu button for items with hasCreateMenu */}
          {item.hasCreateMenu && !isCollapsed && (
            <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-md transition-colors mr-1',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" side="right">
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-8 h-9"
                      autoFocus
                    />
                  </div>
                </div>
                
                {customers.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="max-h-48 overflow-y-auto">
                      {customers.map((customer) => (
                        <DropdownMenuItem
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {customer.display_name || `${customer.first_name} ${customer.last_name}`}
                            </span>
                            {customer.email && (
                              <span className="text-xs text-muted-foreground">{customer.email}</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateWithoutCustomer} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Create without customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {!isCollapsed && isOpen && (
          <div className="ml-4 pl-3 border-l border-sidebar-border space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                to={child.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  location.pathname === child.href && 'bg-sidebar-primary text-sidebar-primary-foreground'
                )}
              >
                {child.icon && <child.icon className="h-3.5 w-3.5" />}
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }


  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Link
            to={item.href!}
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-md transition-colors mx-auto',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              location.pathname === item.href && 'bg-sidebar-primary text-sidebar-primary-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to={item.href!}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        location.pathname === item.href && 'bg-sidebar-primary text-sidebar-primary-foreground'
      )}
    >
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
    </Link>
  );
}

function AppLayoutInner() {
  const { user, loading, signOut, role } = useAuth();
  const { openTab, tabs } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Route to tab type mapping - each submenu gets its own tab type
  const getTabForRoute = (pathname: string): { type: string; title: string } | null => {
    // Dashboard
    if (pathname === '/dashboard') return { type: 'dashboard', title: 'Dashboard' };
    
    // Purchasing routes
    if (pathname === '/purchasing/orders' || pathname.match(/^\/purchasing\/orders\/[a-f0-9-]+$/)) {
      return { type: 'po-list', title: 'Purchase Orders' };
    }
    if (pathname === '/purchasing/drafts') return { type: 'po-draft', title: 'Draft POs' };
    if (pathname === '/purchasing/issued') return { type: 'po-issued', title: 'Issued POs' };
    if (pathname === '/purchasing/receiving') return { type: 'receiving', title: 'Receiving' };
    if (pathname === '/purchasing/vendors' || pathname.match(/^\/purchasing\/vendors\/[a-f0-9-]+$/)) {
      return { type: 'vendors-list', title: 'Vendors' };
    }
    if (pathname === '/purchasing/vendor-drafts') return { type: 'vendor-drafts', title: 'Vendor Drafts' };
    if (pathname === '/purchasing/reorder-drafts') return { type: 'reorder-drafts', title: 'Reorder Suggestions' };
    if (pathname === '/purchasing/disassembly') return { type: 'disassembly-orders', title: 'Disassembly Orders' };
    
    // Estimates routes
    if (pathname === '/estimates' || pathname.match(/^\/estimates\/[a-f0-9-]+$/)) {
      return { type: 'estimates-list', title: 'Estimates' };
    }
    if (pathname === '/estimates/email-templates') return { type: 'email-templates', title: 'Email Templates' };
    if (pathname === '/estimates/templates') return { type: 'job-templates', title: 'Job Templates' };
    if (pathname === '/estimates/waitlist') return { type: 'waitlist', title: 'Waitlist' };
    
    // Customers routes
    if (pathname === '/customers' || pathname.match(/^\/customers\/[a-f0-9-]+$/)) {
      return { type: 'customers-list', title: 'Customers' };
    }
    
    // Inventory routes - each gets own tab
    if (pathname === '/inventory/parts' || pathname.match(/^\/inventory\/parts\/[a-f0-9-]+$/)) {
      return { type: 'parts-list', title: 'Parts' };
    }
    if (pathname === '/inventory/products') return { type: 'products-services', title: 'Products & Services' };
    if (pathname === '/inventory/calibers') return { type: 'calibers', title: 'Calibers' };
    if (pathname === '/inventory/reorder-alerts') return { type: 'reorder-alerts', title: 'Reorder Alerts' };
    if (pathname === '/inventory/cycle-count' || pathname.match(/^\/inventory\/cycle-count\//)) {
      return { type: 'cycle-count', title: 'Cycle Count' };
    }
    if (pathname === '/inventory/quick-move') return { type: 'quick-move', title: 'Quick Move' };
    if (pathname === '/inventory/client-property') return { type: 'client-property', title: 'Client Property' };
    
    // Intake routes - each gets own tab
    if (pathname === '/intake/leads') return { type: 'intake-leads', title: 'Requests' };
    if (pathname === '/intake/email') return { type: 'intake-email', title: 'Intake Email' };
    if (pathname === '/intake/inspections') return { type: 'intake-inspections', title: 'Inspections' };
    if (pathname === '/intake/receive-watch') return { type: 'intake-receive', title: 'Receive Watch' };
    
    // Sales routes
    if (pathname === '/sales/orders') return { type: 'sales-orders', title: 'Sales Orders' };
    
    // Reports routes - each gets own tab
    if (pathname === '/reports/analytics') return { type: 'analytics', title: 'Analytics' };
    if (pathname === '/reports/band-funnel') return { type: 'band-funnel', title: 'Band Estimates Funnel' };
    if (pathname === '/reports/inventory') return { type: 'inventory-report', title: 'Inventory Valuation' };
    if (pathname === '/reports/transactions') return { type: 'transactions-report', title: 'Transactions' };
    
    return null;
  };

  // Check if we're on a workspace-enabled route
  const tabConfig = getTabForRoute(location.pathname);
  const isWorkspaceRoute = tabConfig !== null;

  // Auto-open appropriate tab when navigating to workspace routes
  useEffect(() => {
    if (tabConfig) {
      openTab({ type: tabConfig.type as any, title: tabConfig.title });
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleSidebarTabOpen = (type: string, title: string) => {
    const tabTypeMap: Record<string, any> = {
      'po-list': { type: 'po-list', title: 'Purchase Orders' },
      'po-draft': { type: 'po-draft', title: 'Draft POs' },
      'po-issued': { type: 'po-issued', title: 'Issued POs' },
      'po-received': { type: 'po-received', title: 'Received POs' },
      'vendors-list': { type: 'vendors-list', title: 'Vendors' },
      'parts-list': { type: 'parts-list', title: 'Parts' },
      'customers-list': { type: 'customers-list', title: 'Customers' },
      'dashboard': { type: 'dashboard', title: 'Dashboard' },
      'vendor-drafts': { type: 'vendor-drafts', title: 'Vendor Drafts' },
      'reorder-drafts': { type: 'reorder-drafts', title: 'Reorder Suggestions' },
    };
    
    const tabConfig = tabTypeMap[type];
    if (tabConfig) {
      openTab(tabConfig);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16',
          'hidden lg:flex',
          mobileOpen && 'flex translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', !sidebarOpen && 'justify-center px-2')}>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Box className="h-7 w-7 text-sidebar-primary" />
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-serif text-xl font-semibold leading-tight">RolliSuite</span>
                <span className="text-[10px] text-sidebar-foreground/60 tracking-wide">Enterprise Resource Planner</span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className={cn('space-y-1', sidebarOpen ? 'px-3' : 'px-2')}>
            {navigation.map((item) => (
              <NavItemComponent key={item.label} item={item} isCollapsed={!sidebarOpen} />
            ))}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className={cn('p-4 border-t border-sidebar-border', !sidebarOpen && 'p-2')}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={signOut} className="w-10 h-10 mx-auto text-sidebar-foreground hover:bg-sidebar-accent">
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-sidebar-background border border-sidebar-border flex items-center justify-center hover:bg-sidebar-accent transition-colors hidden lg:flex"
        >
          {sidebarOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-180" />}
        </button>
      </aside>

      {/* Main content */}
      <div className={cn('flex-1 flex flex-col transition-all duration-300', sidebarOpen ? 'lg:ml-64' : 'lg:ml-16')}>
        {/* Top toolbar */}
        <header className="h-14 border-b bg-card flex items-center gap-2 px-4 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openTab({ type: 'new-po', title: 'New Purchase Order' })}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>

          <div className="flex-1 flex justify-center">
            <GlobalSearch />
          </div>
        </header>

        {/* Tab bar - show globally when tabs exist */}
        {tabs.length > 0 && <TabBar />}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {/* 
            Use WorkspaceContent only for true workspace routes.
            Standalone pages (intake, import wizards, etc.) should always render via Outlet.
          */}
          {(() => {
            // These routes should always render via Outlet (standalone pages)
            const standaloneRoutes = [
              '/intake/leads',
              '/intake/email', 
              '/intake/inspections',
              '/intake/receive-watch',
              '/purchasing/vendors/import',
              '/inventory/parts',
              '/inventory/parts/import',
              '/inventory/parts/import-qty',
              '/inventory/parts/import-pricing',
              '/inventory/cycle-count',
              '/inventory/quick-move',
              '/inventory/products',
              '/estimates',
              '/estimates/new',
              '/estimates/templates',
              '/customers',
              '/dashboard',
              '/labels',
            ];
            
            // Also check for UUID-based detail routes that should render via Outlet
            const uuidPattern = /^\/estimates\/[a-f0-9-]{36}$/;
            const customerUuidPattern = /^\/customers\/[a-f0-9-]{36}$/;
            const isDetailPage = uuidPattern.test(location.pathname) || customerUuidPattern.test(location.pathname);
            
            const isStandalonePage = standaloneRoutes.some(route => 
              location.pathname === route || location.pathname.startsWith(route + '/')
            ) || isDetailPage;
            
            if (isStandalonePage) {
              return <Outlet />;
            }
            
            // For workspace routes with tabs, use WorkspaceContent
            if (location.pathname === '/workspace' || (isWorkspaceRoute && tabs.length > 0)) {
              return <WorkspaceContent />;
            }
            
            return <Outlet />;
          })()}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <WorkspaceProvider>
      <AppLayoutInner />
    </WorkspaceProvider>
  );
}
