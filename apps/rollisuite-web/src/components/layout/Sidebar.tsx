import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ClipboardList,
  FileText,
  Users,
  Clock,
  FolderOpen,
  Mail,
  Microscope,
  Box,
  ShoppingCart,
  Truck,
  Package,
  Printer,
  BarChart3,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  Target,
  History,
  Tag,
  FileSpreadsheet,
  Building2,
  Wrench,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Move,
  Home as HomeIcon,
  BookMarked,
  Repeat
} from 'lucide-react';

interface SubMenuItem {
  name: string;
  href: string;
  icon: any;
}

interface MenuItem {
  name: string;
  href?: string;
  icon: any;
  expandable?: boolean;
  subItems?: SubMenuItem[];
  highlight?: 'gold' | 'green';
}

export default function Sidebar() {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const navigation: MenuItem[] = [
    { 
      name: 'Home', 
      href: '/', 
      icon: ClipboardList,
      highlight: 'gold'
    },
    { 
      name: 'Estimates', 
      icon: FileText,
      expandable: true,
      subItems: [
        { name: 'Requests', href: '/estimates/requests', icon: FileText },
        { name: 'All Estimates', href: '/estimates', icon: FileText },
        { name: 'Customers', href: '/customers', icon: Users },
        { name: 'Waitlist', href: '/waitlist', icon: Clock },
        { name: 'Job Templates', href: '/job-templates', icon: FolderOpen },
        { name: 'Email Templates', href: '/email-templates', icon: Mail },
      ]
    },
    { 
      name: 'Inspection Photos', 
      href: '/inspection-photos', 
      icon: Microscope 
    },
    { 
      name: 'Intake', 
      icon: Box,
      expandable: true,
      subItems: [
        { name: 'Shipping Labels', href: '/intake/shipping-labels', icon: Printer },
        { name: 'Receive Packages', href: '/intake/receive-packages', icon: Package },
        { name: 'Email', href: '/intake/email', icon: Mail },
        { name: 'Receive Watch', href: '/watches', icon: Clock },
        { name: 'Intake History', href: '/intake/history', icon: History },
      ]
    },
    { 
      name: 'Sales', 
      icon: ShoppingCart,
      expandable: true,
      subItems: [
        { name: 'Sales Orders', href: '/sales-orders', icon: FileSpreadsheet },
        { name: 'Pickup Station', href: '/sales/pickup-station', icon: Home as any },
        { name: 'Ship Station', href: '/sales/ship-station', icon: Truck },
      ]
    },
  ];

  const navigationGroup2: MenuItem[] = [
    { 
      name: 'Purchasing', 
      icon: Truck,
      expandable: true,
      subItems: [
        { name: 'Purchase Orders', href: '/purchasing/purchase-orders', icon: FileText },
        { name: 'Draft POs', href: '/purchasing/draft-pos', icon: FileText },
        { name: 'Issued POs', href: '/purchasing/issued-pos', icon: Truck },
        { name: 'Vendors', href: '/purchasing/vendors', icon: Building2 },
        { name: 'Vendor Drafts', href: '/purchasing/vendor-drafts', icon: FileText },
        { name: 'Reorder Drafts', href: '/purchasing/reorder-drafts', icon: Repeat },
        { name: 'Shop Work Orders', href: '/purchasing/shop-work-orders', icon: Wrench },
        { name: 'Disassembly Orders', href: '/purchasing/disassembly-orders', icon: Layers },
        { name: 'Receiving', href: '/purchasing/receiving', icon: Truck },
      ]
    },
    { 
      name: 'Inventory', 
      icon: Package,
      expandable: true,
      subItems: [
        { name: 'Parts', href: '/parts', icon: Package },
        { name: 'Part Categories', href: '/inventory/part-categories', icon: Tag },
        { name: 'Products & Services', href: '/inventory/products-services', icon: Box },
        { name: 'Calibers', href: '/inventory/calibers', icon: Target },
        { name: 'Reorder Alerts', href: '/inventory/reorder-alerts', icon: AlertTriangle },
        { name: 'Low Stock Report', href: '/inventory/low-stock-report', icon: TrendingDown },
        { name: 'Cycle Count', href: '/inventory/cycle-count', icon: RefreshCw },
        { name: 'Quick Move', href: '/inventory/quick-move', icon: Move },
        { name: 'Client Property', href: '/inventory/client-property', icon: Layers },
        { name: 'Reference Library', href: '/inventory/reference-library', icon: BookMarked },
      ]
    },
    { 
      name: 'Labels', 
      href: '/labels', 
      icon: Printer 
    },
    { 
      name: 'Reports', 
      href: '/reports', 
      icon: BarChart3 
    },
    { 
      name: 'Accounting', 
      href: '/accounting', 
      icon: BookOpen 
    },
    { 
      name: 'Setup', 
      icon: Settings,
      expandable: true,
      subItems: [
        { name: 'Import / Export', href: '/setup/import-export', icon: ArrowRightLeft },
        { name: 'QBO Account Mappings', href: '/setup/qbo-mappings', icon: FileText },
      ]
    },
  ];

  const navigationGroup3: MenuItem[] = [
    { 
      name: 'Daily Hit List', 
      href: '/daily-hit-list', 
      icon: Target,
      highlight: 'green'
    },
    { 
      name: 'Job History', 
      href: '/jobs', 
      icon: History 
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isExpanded = expandedSections.includes(item.name);
    const isActive = item.href && location.pathname === item.href;

    if (item.expandable && item.subItems) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleSection(item.name)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:bg-gray-800"
          >
            <div className="flex items-center space-x-3">
              <Icon size={20} />
              <span>{item.name}</span>
            </div>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {isExpanded && (
            <div className="ml-6 mt-1 space-y-1 border-l border-gray-700 pl-3">
              {item.subItems.map((subItem) => {
                const SubIcon = subItem.icon;
                const isSubActive = location.pathname === subItem.href;
                return (
                  <Link
                    key={subItem.name}
                    to={subItem.href}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors
                      ${isSubActive 
                        ? 'bg-gray-800 text-blue-400' 
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }
                    `}
                  >
                    <SubIcon size={18} />
                    <span>{subItem.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const highlightClass = item.highlight === 'gold' 
      ? 'bg-yellow-600 text-gray-900 hover:bg-yellow-500' 
      : item.highlight === 'green'
      ? 'bg-green-600 text-white hover:bg-green-500'
      : isActive
      ? 'bg-gray-800 text-blue-400'
      : 'text-gray-300 hover:bg-gray-800';

    return (
      <Link
        key={item.name}
        to={item.href || '#'}
        className={`
          flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${highlightClass}
        `}
      >
        <div className="flex items-center space-x-3">
          <Icon size={20} />
          <span>{item.name}</span>
        </div>
        {!item.highlight && !item.expandable && <ChevronRight size={16} className="opacity-50" />}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-[calc(100vh-57px)] flex flex-col">
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {/* Main Navigation Group */}
        {navigation.map(renderMenuItem)}
        
        {/* Separator */}
        <div className="border-t border-gray-700 my-4"></div>
        
        {/* Second Navigation Group */}
        {navigationGroup2.map(renderMenuItem)}
        
        {/* Separator */}
        <div className="border-t border-gray-700 my-4"></div>
        
        {/* Third Navigation Group */}
        {navigationGroup3.map(renderMenuItem)}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-gray-800 p-4">
        <Link
          to="/settings"
          className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-gray-300 hover:bg-gray-800"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Users size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">admin@rollisuite.com</span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </aside>
  );
}
