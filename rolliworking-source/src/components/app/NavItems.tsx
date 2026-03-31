import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileWarning,
  FileBarChart,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  ListChecks,
  Mail,
  ScanLine,
  UserCog,
  Users,
  Wrench,
  Package,
  FileText,
  ShieldCheck,
  RefreshCw,
  Activity,
  QrCode,
  UserCheck,
  Target,
} from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SubItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission: string;
  subItems?: SubItem[];
}

// Navigation items configuration
const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/work-queue", label: "Work Queue", icon: Wrench, permission: "jobs.view" },
  { to: "/station-scanner", label: "Station Scanner", icon: ScanLine, permission: "jobs.view" },
  
  { to: "/inspections/new", label: "Inspections", icon: ClipboardCheck, permission: "inspections.view" },
  { to: "/history", label: "History", icon: History, permission: "history.view" },
  { to: "/reports", label: "Reports", icon: FileText, permission: "reports.view" },
  { to: "/waiver-history", label: "Liability Waiver", icon: FileWarning, permission: "waivers.view" },
  { to: "/parts-request", label: "Request Part", icon: Package, permission: "parts.view" },
  { to: "/parts-history", label: "Parts Request History", icon: History, permission: "parts_history.view" },
  { to: "/follow-up-queue", label: "Follow Up Queue", icon: Wrench, permission: "jobs.view" },
  { 
    to: "/data", 
    label: "Data", 
    icon: Database, 
    permission: "reports.view",
    subItems: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/daily-hit-list", label: "Daily Hit List", icon: Target },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/analytics/status-changes", label: "Status Changes", icon: ListChecks },
      { to: "/movement-performance", label: "Movement Performance", icon: Activity },
      { to: "/watchmaker-activity", label: "Pipeline", icon: UserCheck },
      { to: "/weekly-watchmaker-report", label: "Weekly Report", icon: FileBarChart },
      { to: "/data-management", label: "Data Management", icon: Database },
      { to: "/email-templates", label: "Email Templates", icon: Mail },
      { to: "/users", label: "Users", icon: UserCog },
      { to: "/watchmakers", label: "Watchmakers", icon: Users },
      { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
      { to: "/inspection-scantron", label: "Scantron Sheet", icon: FileSpreadsheet },
      { to: "/wiki", label: "Documentation", icon: BookOpen },
    ],
  },
];

interface NavItemsProps {
  userPermissions: string[] | undefined;
  isFetched: boolean;
  canSync: boolean;
}

export function NavItems({ userPermissions, isFetched, canSync }: NavItemsProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter nav items based on user permissions
  const visibleNavItems = !isFetched
    ? []
    : navItems.filter((item) => hasPermission(userPermissions, item.permission));

  const handleSyncCustomers = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canSync) {
      toast.error("Only managers can run client sync");
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "rollisuite-customer-sync",
        { method: "POST", body: {} },
      );

      if (error) {
        toast.error(`Sync failed: ${error.message}`);
        return;
      }

      if (data?.warning) toast.warning(data.warning);

      if (data?.success) {
        toast.success(data.message || "Sync complete");
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else {
        toast.error(data?.error || "Sync failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync customers");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SidebarMenu>
      {visibleNavItems.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        const hasSubItems = item.subItems && item.subItems.length > 0;

        // Render collapsible menu for items with sub-items
        if (hasSubItems) {
          return (
            <Collapsible key={item.to} defaultOpen={active || item.subItems?.some(s => pathname === s.to || pathname.startsWith(s.to + "/"))} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={active} tooltip={item.label}>
                    <Icon />
                    <span>{item.label}</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.subItems!.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const subActive = pathname === subItem.to || pathname.startsWith(subItem.to + "/");
                      const isClientsSub = subItem.to === "/clients";
                      return (
                        <SidebarMenuSubItem key={subItem.to}>
                          <div className="flex items-center gap-1">
                            <SidebarMenuSubButton asChild isActive={subActive} className="flex-1">
                              <Link
                                to={subItem.to}
                                className={
                                  subItem.to === "/daily-hit-list" ? "text-red-500 hover:text-red-600 font-semibold" :
                                  subItem.to === "/weekly-watchmaker-report" ? "text-blue-500 hover:text-blue-600 font-semibold" : ""
                                }
                              >
                                <SubIcon className={`h-4 w-4 ${
                                  subItem.to === "/daily-hit-list" ? "text-red-500" :
                                  subItem.to === "/weekly-watchmaker-report" ? "text-blue-500" : ""
                                }`} />
                                <span>{subItem.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                            {isClientsSub && (
                              <>
                                <div className="flex items-center justify-center h-6 w-6 shrink-0" title="QR Scanner Available">
                                  <QrCode className="h-3 w-3 text-sidebar-foreground/70" />
                                </div>
                                {canSync && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={handleSyncCustomers}
                                    disabled={isSyncing}
                                    title="Sync from RolliSuite"
                                  >
                                    <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        }

        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
              <Link to={item.to} aria-label={item.label}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
