import * as React from "react";
import { format } from "date-fns";
import { Loader2, Search, Shield, User, FileText, Mail, Clock, Filter } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuditLogs, type AuditLog } from "@/hooks/use-security";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_ICONS: Record<string, typeof Shield> = {
  login: User,
  logout: User,
  set_user_pin: Shield,
  clear_user_pin: Shield,
  pin_verified: Shield,
  pin_failed: Shield,
  job_created: FileText,
  job_updated: FileText,
  job_deleted: FileText,
  email_sent: Mail,
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-500/10 text-green-600",
  logout: "bg-slate-500/10 text-slate-600",
  set_user_pin: "bg-blue-500/10 text-blue-600",
  clear_user_pin: "bg-orange-500/10 text-orange-600",
  pin_verified: "bg-green-500/10 text-green-600",
  pin_failed: "bg-red-500/10 text-red-600",
  job_created: "bg-blue-500/10 text-blue-600",
  job_updated: "bg-amber-500/10 text-amber-600",
  job_deleted: "bg-red-500/10 text-red-600",
  email_sent: "bg-purple-500/10 text-purple-600",
};

export default function AuditLogsPage() {
  const [userFilter, setUserFilter] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("");
  const [page, setPage] = React.useState(0);
  const limit = 50;

  usePageMeta({
    title: "Audit Logs | Rolliworks",
    description: "View security and activity audit logs",
    canonicalPath: "/audit-logs",
  });

  const { data, isLoading, error } = useAuditLogs({
    limit,
    offset: page * limit,
    userFilter: userFilter || undefined,
    actionFilter: actionFilter || undefined,
  });

  const logs = (data?.logs as AuditLog[]) || [];
  const total = (data?.total as number) || 0;
  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <main className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">
              {(error as Error)?.message || "Failed to load audit logs. Only owners can access this page."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track security events and user activity
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by user email..."
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(value) => {
            setActionFilter(value === "all" ? "" : value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="pin">PIN events</SelectItem>
            <SelectItem value="job">Job events</SelectItem>
            <SelectItem value="email">Email events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total} events
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const Icon = ACTION_ICONS[log.action] || Shield;
                const colorClass = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground";

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-md ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        {log.resource_type && (
                          <Badge variant="outline" className="text-xs">
                            {log.resource_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.user_email || "Unknown user"}
                        {log.ip_address && ` • ${log.ip_address}`}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, h:mm a")}
                    </time>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
