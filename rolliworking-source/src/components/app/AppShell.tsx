import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { LogOut, Clock, MessageSquare, Bot } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserPermissions } from "@/hooks/use-permissions";
import { useUserRole, canEditJobFields } from "@/hooks/use-user-role";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { JobHistoryLookup } from "@/components/jobs/JobHistoryLookup";
import { AiAssistant } from "@/components/assistant/AiAssistant";
import { NavItems } from "./NavItems";

export function AppShell() {
  const { session, signOut } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const { data: userRole, isLoading: isRoleLoading } = useUserRole();
  const canSync = isRoleLoading ? true : canEditJobFields(userRole);

  // Get user's permissions
  const { data: userPermissions, isFetched } = useUserPermissions();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              R
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-none">ROLLIWORKS</div>
              <div className="truncate text-xs text-sidebar-foreground/70">Client Portal</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <NavItems 
            userPermissions={userPermissions} 
            isFetched={isFetched} 
            canSync={canSync} 
          />
        </SidebarContent>

        <SidebarFooter>
          <Button
            asChild
            className="w-full justify-start bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <Link to="/client-replies">
              <MessageSquare className="h-4 w-4" />
              Client Replies
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setHistoryOpen(true)}
          >
            <Clock className="h-4 w-4" />
            Job History
          </Button>
          <div className="px-2 pb-1 text-xs text-sidebar-foreground/70">{session?.user?.email ?? ""}</div>
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut />
            Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>

      <JobHistoryLookup open={historyOpen} onOpenChange={setHistoryOpen} />
      <AiAssistant open={assistantOpen} onOpenChange={setAssistantOpen} />

      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/60 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <SidebarTrigger />
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAssistantOpen(true)}
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Assistant</span>
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:block">RolliWorks</span>
          </div>
        </header>

        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
