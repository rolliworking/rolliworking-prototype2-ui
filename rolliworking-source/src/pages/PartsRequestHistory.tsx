import * as React from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useJobs } from "@/hooks/use-jobs";
import { useUserRole } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Package, Clock, Truck, Pencil, Trash2, Archive, ArchiveX, MessageSquare, ShieldCheck, ShieldAlert } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { toast } from "sonner";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/job-utils";

type PartsApprovalStatus = "pending" | "approved" | "on_order" | "denied" | "draft" | "submitted" | "archived";

interface PartRequest {
  id: string;
  name?: string;
  description?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  status?: string;
}

interface JobWithParts {
  id: string;
  client_name: string | null;
  serial_number: string | null;
  estimate_number: string | null;
  parts_approval_status: PartsApprovalStatus | null;
  status: string;
  request_numbers: string[];
  parts_requests: PartRequest[];
  needs_liability_waiver: boolean | null;
  waiver_signed: boolean | null;
  updated_at: string;
}

const getStatusBadge = (status: PartsApprovalStatus | null) => {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
    case "approved":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
    case "on_order":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">On Order</Badge>;
    case "denied":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Denied</Badge>;
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
};

const PartsRequestHistory = () => {
  usePageMeta({
    title: "Parts Request History • WatchFlow",
    description: "View parts request history by status",
    canonicalPath: "/parts-history",
  });

  const queryClient = useQueryClient();
  const { data: allJobs, isLoading } = useJobs();
  const { data: userRole } = useUserRole();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const isStaff = userRole === "staff";

  // Filter jobs that have parts requests
  // Include all jobs with parts requests - finished jobs can still have archived parts to view
  const jobsWithParts = React.useMemo(() => {
    if (!allJobs) return [];
    
    return (allJobs as any[]).filter((job) => {
      const partsRequests = job.parts_requests as any[] | null;
      return Array.isArray(partsRequests) && partsRequests.length > 0;
    }).map((job) => {
      const partsRequests = job.parts_requests as PartRequest[] | null;
      const requestNumbers = partsRequests
        ? [...new Set(partsRequests.map((p: any) => p.request_number).filter(Boolean))]
        : [];
      return {
        id: job.id,
        client_name: job.client_name,
        serial_number: job.serial_number,
        estimate_number: job.estimate_number,
        parts_approval_status: job.parts_approval_status as PartsApprovalStatus | null,
        status: job.status,
        request_numbers: requestNumbers as string[],
        parts_requests: partsRequests || [],
        needs_liability_waiver: job.needs_liability_waiver ?? null,
        waiver_signed: job.waiver_signed ?? null,
        updated_at: job.updated_at,
      };
    }) as JobWithParts[];
  }, [allJobs]);

  // Statuses where the job has moved past the parts approval workflow stage
  // Once a job leaves "parts_approval", the admin has already processed the response
  const pastPartsStageStatuses = ["in_progress", "parts_on_order", "in_testing", "finished"];

  // Helper: check if all individual parts in the request have been answered
  // (none still have "pending" status) — handles cases where job-level
  // parts_approval_status is stale but the parts themselves were answered.
  const allPartsAnswered = (parts: PartRequest[]) => {
    if (parts.length === 0) return false;
    return parts.every(p => p.status === "approved" || p.status === "declined" || p.status === "on_order");
  };

  // Helper: check if ANY individual part has been answered (approved/declined/on_order)
  const anyPartAnswered = (parts: PartRequest[]) => {
    return parts.some(p => p.status === "approved" || p.status === "declined" || p.status === "on_order");
  };

  // Partition by status — use individual part statuses as ground truth
  const pendingJobs = jobsWithParts.filter((j) => {
    // If any part has been individually answered, this is NOT pending anymore
    if (allPartsAnswered(j.parts_requests)) return false;
    if (anyPartAnswered(j.parts_requests)) return false;
    // Exclude jobs that have already moved past the parts stage in the workflow
    if (pastPartsStageStatuses.includes(j.status)) return false;
    // Exclude explicitly approved/denied/on_order/archived at job level
    if (j.parts_approval_status === "approved" || j.parts_approval_status === "denied" || j.parts_approval_status === "on_order" || j.parts_approval_status === "archived") return false;
    return true;
  });
  const answeredJobs = jobsWithParts.filter((j) => {
    if (j.parts_approval_status === "on_order" || j.parts_approval_status === "archived") return false;
    // Any part answered = answered
    if (anyPartAnswered(j.parts_requests)) return true;
    if (allPartsAnswered(j.parts_requests)) return true;
    return j.parts_approval_status === "approved" || j.parts_approval_status === "denied";
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const onOrderJobs = jobsWithParts.filter((j) => j.parts_approval_status === "on_order");
  const archivedJobs = jobsWithParts.filter((j) => j.parts_approval_status === "archived");

  // Helper to render parts list with colors
  const renderPartsList = (parts: PartRequest[]) => {
    const approvedParts = parts.filter(p => p.status === "approved");
    const declinedParts = parts.filter(p => p.status === "declined");
    
    if (approvedParts.length === 0 && declinedParts.length === 0) return null;
    
    return (
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {approvedParts.map((part, idx) => (
            <span key={`approved-${part.id || idx}`} className="text-green-600 dark:text-green-500">
              • {part.name || part.description || "Unnamed part"} {part.price != null ? `($${part.price})` : ""} {(part.quantity || part.qty || 0) > 1 ? `×${part.quantity || part.qty}` : ""}
            </span>
          ))}
          {declinedParts.map((part, idx) => (
            <span key={`declined-${part.id || idx}`} className="text-red-600 dark:text-red-500">
              • {part.name || part.description || "Unnamed part"} {part.price != null ? `($${part.price})` : ""} {(part.quantity || part.qty || 0) > 1 ? `×${part.quantity || part.qty}` : ""}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const handleDeletePartsRequest = async (jobId: string) => {
    setDeletingId(jobId);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ 
          parts_requests: [],
          parts_approval_status: "draft"
        })
        .eq("id", jobId);

      if (error) throw error;

      toast.success("Parts request deleted");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete parts request");
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchive = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ parts_approval_status: "archived" })
        .eq("id", jobId);

      if (error) throw error;

      toast.success("Parts request archived");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to archive parts request");
    }
  };

  // Check if staff can edit/delete based on status
  // Staff can only edit/delete pending (draft/submitted) requests that haven't been sent to client
  const canStaffModify = (status: PartsApprovalStatus | null) => {
    if (!isStaff) return true; // Manager/Owner can always modify
    // Staff can only modify draft or submitted (before sent to client)
    return status === "draft" || status === "submitted" || !status;
  };

  const renderJobList = (jobs: JobWithParts[], emptyMessage: string, showArchive = false, showPartsList = false, showApprovedDate = false) => {
    if (jobs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {jobs.map((job) => {
          const canModify = canStaffModify(job.parts_approval_status);
          const editUrl = `/parts-request?edit=${job.id}`;

          return (
            <div
              key={job.id}
              className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {job.client_name || "Unknown Customer"}
                    </p>
                    {job.request_numbers.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {job.request_numbers.join(", ")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>Ref #: {job.serial_number || "N/A"}</span>
                    <span>•</span>
                    <span>Est#: {job.estimate_number || "N/A"}</span>
                    {job.needs_liability_waiver && (
                      <>
                        <span>•</span>
                        {job.waiver_signed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Waiver received
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Waiver pending
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {showApprovedDate && job.updated_at && (
                    <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                      {format(new Date(job.updated_at), "MMM d, yyyy")}
                    </Badge>
                  )}
                  {getStatusBadge(job.parts_approval_status)}
                  <Badge variant="outline" className={JOB_STATUS_COLORS[job.status as keyof typeof JOB_STATUS_COLORS] || ""}>
                    {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || job.status}
                  </Badge>
                  
                  {showArchive && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => handleArchive(job.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  {canModify && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={editUrl}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}

                  {canModify && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === job.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Parts Request?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove all parts from this request. The job will remain but without any parts requested.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeletePartsRequest(job.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
              {showPartsList && renderPartsList(job.parts_requests)}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <main className="container max-w-4xl py-6 space-y-6">
        <h1 className="text-2xl font-bold">Parts Request History</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Parts Request History</h1>
      </div>

      <Tabs defaultValue="answered" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="answered" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Answered ({answeredJobs.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingJobs.length})
          </TabsTrigger>
          <TabsTrigger value="on_order" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            On Order ({onOrderJobs.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <ArchiveX className="h-4 w-4" />
            Archived ({archivedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="answered" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Client Responses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderJobList(answeredJobs, "No client responses yet", true, true, true)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderJobList(pendingJobs, "No pending parts requests")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="on_order" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Parts On Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderJobList(onOrderJobs, "No parts on order")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArchiveX className="h-5 w-5 text-muted-foreground" />
                Archived Parts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderJobList(archivedJobs, "No archived parts requests")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default PartsRequestHistory;
