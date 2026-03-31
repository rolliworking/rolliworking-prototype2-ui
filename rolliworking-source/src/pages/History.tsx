import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { ResponsesInbox } from "@/components/history/ResponsesInbox";
import { NoReplyInbox } from "@/components/history/NoReplyInbox";
import { useInspections, useDeleteInspection } from "@/hooks/use-inspections";
import { useJobs } from "@/hooks/use-jobs";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { getLatestMeaningfulApprovalsByInspection } from "@/lib/inspection-approval-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Loader2, FileText, Briefcase, Pencil, Search, Trash2, Clock, History as HistoryIcon, MessageSquareReply, MailX } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "inspections" | "jobs";
type InspectionTab = "recent" | "total" | "responses" | "no_reply";
type StatusFilter = "all" | "draft" | "saved" | "sent";

export default function History() {
  usePageMeta({
    title: "History | Rolliworks",
    description: "View inspection and job history",
    canonicalPath: "/history",
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [noReplyCount, setNoReplyCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("inspections");
  const [inspectionTab, setInspectionTab] = useState<InspectionTab>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteInspection = useDeleteInspection();

  // Fetch approval map (for reply icons on inspection rows)
  const [approvalMap, setApprovalMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchApprovals = async () => {
      const { data } = await supabase
        .from("inspection_approvals")
        .select("id, inspection_id, status, created_at, approved_at");
      if (data) {
        const latestByInspection = getLatestMeaningfulApprovalsByInspection(data);
        const map = new Map<string, string>();
        for (const [inspectionId, approval] of latestByInspection.entries()) {
          if (approval.status === "approved") {
            map.set(inspectionId, approval.id);
          }
        }
        setApprovalMap(map);
      }
    };
    fetchApprovals();
  }, []);

  // Debounce search for server-side queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pass debounced search to server-side query for inspections
  const { data: inspections, isLoading: inspectionsLoading } = useInspections(debouncedSearch);
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  const filteredInspections = useMemo(() => {
    if (!inspections) return [];
    let filtered = [...inspections];
    
    if (statusFilter !== "all") {
      // Handle "sent" filter to also match "approved" status from DB
      const statusesToMatch = statusFilter === "sent" ? ["sent", "approved"] : [statusFilter];
      filtered = filtered.filter((i) => statusesToMatch.includes(i.status));
    }
    
    return filtered;
  }, [inspections, statusFilter]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!debouncedSearch.trim()) return jobs;
    
    const term = debouncedSearch.toLowerCase();
    return jobs.filter((j) => {
      const name = (j.inspections?.watches?.customers?.name || j.client_name || "").toLowerCase();
      const email = (j.inspections?.watches?.customers?.email || j.client_email || "").toLowerCase();
      const refNumber = (j.inspections?.watches?.reference_number || j.serial_number || "").toLowerCase();
      const estNumber = (j.inspections?.watches?.estimate_number || j.estimate_number || "").toLowerCase();
      return name.includes(term) || email.includes(term) || refNumber.includes(term) || estNumber.includes(term);
    });
  }, [jobs, debouncedSearch]);


  const recentInspections = useMemo(() => {
    return filteredInspections.slice(0, 10);
  }, [filteredInspections]);

  const pastInspections = useMemo(() => {
    return [...filteredInspections].sort((a, b) => {
      const nameA = (a.watches?.customers?.name || "").split(" ")[0].toLowerCase();
      const nameB = (b.watches?.customers?.name || "").split(" ")[0].toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [filteredInspections]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      saved: "secondary",
      sent: "default",
      approved: "default",
    };
    const displayStatus = status === "approved" ? "sent" : status;
    return <Badge variant={variants[status] || "outline"} className="text-[10px] px-1.5 py-0">{displayStatus}</Badge>;
  };

  const handleDeleteClick = (id: string, name: string) => {
    setInspectionToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!inspectionToDelete) return;
    
    try {
      await deleteInspection.mutateAsync(inspectionToDelete.id);
      toast.success("Inspection deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete inspection");
    } finally {
      setDeleteDialogOpen(false);
      setInspectionToDelete(null);
    }
  };

  const isLoading = viewMode === "inspections" ? inspectionsLoading : jobsLoading;

  const renderInspectionRow = (inspection: any) => {
    const approvalId = approvalMap.get(inspection.id);
    return (
      <div key={inspection.id} className="py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            to={`/inspections/new?edit=${inspection.id}`}
            className="text-sm font-medium truncate max-w-[120px] text-primary hover:underline text-left"
          >
            {inspection.watches?.customers?.name || "Unknown"}
          </Link>
          {inspection.watches?.estimate_number && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              #{inspection.watches.estimate_number}
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {inspection.watches?.brand}{inspection.watches?.model && ` ${inspection.watches.model}`}
          </span>
          {inspection.watches?.reference_number && (
            <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
              Ref: {inspection.watches.reference_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(inspection.created_at), "M/d/yy")}
          </span>
          <span className="text-[10px] text-muted-foreground">{inspection.inspection_type.replace('_', ' ')}</span>
          {getStatusBadge(inspection.status)}
          {approvalId && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" asChild title="View Client Approval">
              <Link to={`/view-approval?id=${approvalId}`}>
                <MessageSquareReply className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
            <Link to={`/inspections/new?edit=${inspection.id}`}>
              <Pencil className="h-3 w-3" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => handleDeleteClick(inspection.id, inspection.watches?.customers?.name || "Unknown")}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <div className="flex gap-3">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspections">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Inspections
                </span>
              </SelectItem>
              <SelectItem value="jobs">
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Jobs
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "inspections" && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="saved">Saved</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, reference #..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === "inspections" ? (
        <Tabs value={inspectionTab} onValueChange={(v) => setInspectionTab(v as InspectionTab)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="total" className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" />
              Total History ({filteredInspections.length})
            </TabsTrigger>
            <TabsTrigger value="responses" className="flex items-center gap-2">
              <MessageSquareReply className="h-4 w-4" />
              Responses
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1 min-w-[18px] justify-center">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="no_reply" className="flex items-center gap-2">
              <MailX className="h-4 w-4" />
              No Reply
              {noReplyCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 min-w-[18px] justify-center border-amber-500 text-amber-600">
                  {noReplyCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Inspections (Last 10)</CardTitle>
              </CardHeader>
              <CardContent>
                {recentInspections.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No inspections found.</p>
                ) : (
                  <div className="divide-y">
                    {recentInspections.map(renderInspectionRow)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="total">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">All Inspections (Sorted by First Name)</CardTitle>
              </CardHeader>
              <CardContent>
                {pastInspections.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No inspections found.</p>
                ) : (
                  <div className="divide-y max-h-[600px] overflow-y-auto">
                    {pastInspections.map(renderInspectionRow)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responses">
            <ResponsesInbox searchTerm={debouncedSearch} onUnreadCountChange={setUnreadCount} />
          </TabsContent>

          <TabsContent value="no_reply">
            <NoReplyInbox searchTerm={debouncedSearch} onCountChange={setNoReplyCount} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredJobs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No jobs found.</p>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate max-w-[140px]">
                        {job.inspections?.watches?.customers?.name || job.client_name || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {job.inspections?.watches?.brand || job.watch_brand}{(job.inspections?.watches?.model || job.watch_model) && ` ${job.inspections?.watches?.model || job.watch_model}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        Due: {job.due_date ? format(new Date(job.due_date), "M/d/yy") : "N/A"}
                      </span>
                      <Badge variant={job.status === "completed" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the inspection for "{inspectionToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInspection.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
