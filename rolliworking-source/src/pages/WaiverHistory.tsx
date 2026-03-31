import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  History, 
  Pencil, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Check, 
  X,
  Search,
  FileWarning
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface LiabilityWaiverRecord {
  id: string;
  job_id: string | null;
  waiver_number: string | null;
  status: "draft" | "pending" | "completed";
  customer_name: string | null;
  customer_email: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  serial_number: string | null;
  estimate_number: string | null;
  reference_number: string | null;
  dial_defects: boolean;
  hand_defects: boolean;
  additional_components: string | null;
  additional_info: string | null;
  waiver_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type WaiverRow = LiabilityWaiverRecord & {
  jobs:
    | {
        client_name: string | null;
        client_id: string | null;
        customers: { name: string } | null;
      }
    | null;
  /**
   * Derived for display when waiver.customer_name and job client fields are null.
   * Populated from watches(customers) lookup by estimate_number.
   */
  derived_customer_name?: string | null;
};

function getWaiverDisplayName(waiver: WaiverRow) {
  return (
    waiver.customer_name ||
    waiver.jobs?.client_name ||
    waiver.jobs?.customers?.name ||
    waiver.derived_customer_name ||
    "Pending signature"
  );
}

export default function WaiverHistory() {
  usePageMeta({
    title: "Waiver History | Rolliworks",
    description: "View liability waiver history",
    canonicalPath: "/waiver-history",
  });

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteWaiverId, setDeleteWaiverId] = useState<string | null>(null);

  // Fetch waiver history with job and customer data for client names
  const { data: waivers = [], refetch: refetchWaivers, isLoading } = useQuery<WaiverRow[]>({
    queryKey: ["liability-waivers", "with-names"],
    queryFn: async () => {
      // Fetch waivers with job & customer data for display names
      const { data, error } = await supabase
        .from("liability_waivers")
        .select("*, jobs(client_name, client_id, customers(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const waivers = (data as WaiverRow[]) ?? [];

      // If the waiver/job doesn't carry a client name, derive it from the watch
      // by matching estimate_number -> watches -> customers.
      const needsDerivation = waivers.filter(
        (w) =>
          !w.customer_name &&
          !w.jobs?.client_name &&
          !w.jobs?.customers?.name &&
          !!w.estimate_number
      );

      const estimateNumbers = Array.from(
        new Set(
          needsDerivation
            .map((w) => w.estimate_number)
            .filter((v): v is string => !!v && !!v.trim())
        )
      );

      if (estimateNumbers.length === 0) return waivers;

      const { data: watchesData, error: watchesError } = await supabase
        .from("watches")
        .select("estimate_number, customers(name)")
        .in("estimate_number", estimateNumbers);

      // Don't block the whole page if this secondary lookup fails.
      if (watchesError) {
        console.warn("Failed to derive waiver client names from watches:", watchesError);
        return waivers;
      }

      const byEstimate = new Map<string, string>();
      (watchesData ?? []).forEach((w: any) => {
        const est = w?.estimate_number as string | undefined;
        const name = w?.customers?.name as string | undefined;
        if (est && name) byEstimate.set(est, name);
      });

      return waivers.map((w) => ({
        ...w,
        derived_customer_name: w.estimate_number
          ? byEstimate.get(w.estimate_number) ?? null
          : null,
      }));
    },
  });

  // Filter waivers by search
  const filteredWaivers = waivers.filter((waiver) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    const displayName = getWaiverDisplayName(waiver).toLowerCase();
    return (
      displayName.includes(term) ||
      (waiver.customer_email || "").toLowerCase().includes(term) ||
      (waiver.waiver_number || "").toLowerCase().includes(term) ||
      (waiver.watch_brand || "").toLowerCase().includes(term) ||
      (waiver.serial_number || "").toLowerCase().includes(term) ||
      (waiver.reference_number || "").toLowerCase().includes(term)
    );
  });

  const handleDeleteWaiver = async () => {
    if (!deleteWaiverId) return;

    try {
      const { error } = await supabase
        .from("liability_waivers")
        .delete()
        .eq("id", deleteWaiverId);
      if (error) throw error;
      toast.success("Waiver deleted");
      refetchWaivers();
      setDeleteWaiverId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete waiver");
    }
  };

  const handleMarkWaiverStatus = async (waiverId: string, approved: boolean) => {
    try {
      const waiver = waivers.find((w) => w.id === waiverId);
      if (!waiver) return;

      if (approved) {
        // Mark as approved/completed
        const { error: waiverError } = await supabase
          .from("liability_waivers")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            customer_name: waiver.customer_name || "Approved via email",
          })
          .eq("id", waiverId);
        if (waiverError) throw waiverError;

        // Update job if linked
        if (waiver.job_id) {
          const { error: jobError } = await supabase
            .from("jobs")
            .update({
              needs_liability_waiver: false,
              waiver_signed: true,
            })
            .eq("id", waiver.job_id);
          if (jobError) throw jobError;
        }

        toast.success("Waiver marked as approved");
      } else {
        // Mark as declined - delete the waiver
        const { error } = await supabase
          .from("liability_waivers")
          .delete()
          .eq("id", waiverId);
        if (error) throw error;

        toast.success("Waiver marked as declined and removed");
      }

      refetchWaivers();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      console.error("Error updating waiver status:", error);
      toast.error(error.message || "Failed to update waiver status");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><FileText className="mr-1 h-3 w-3" />Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold">Waiver History</h1>
            <p className="text-xs text-muted-foreground">View and manage liability waivers</p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link to="/liability-waiver">
            <FileWarning className="mr-1 h-3 w-3" />
            New Waiver
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, waiver #, reference #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Waivers ({filteredWaivers.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-6 text-sm">Loading...</p>
          ) : filteredWaivers.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 text-sm">No waivers found</p>
          ) : (
            <div className="space-y-2">
              {filteredWaivers.map((waiver) => (
                <div key={waiver.id} className="flex items-center justify-between p-2.5 rounded-md border bg-card">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {waiver.waiver_number && (
                        <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">{waiver.waiver_number}</span>
                      )}
                      <span className="text-sm font-medium truncate">{getWaiverDisplayName(waiver)}</span>
                      {getStatusBadge(waiver.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {waiver.watch_brand} {waiver.watch_model} 
                      {waiver.serial_number && ` • Ref #: ${waiver.serial_number}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Created: {format(new Date(waiver.created_at), "MMM d, yyyy")}
                      {waiver.completed_at && ` • Completed: ${format(new Date(waiver.completed_at), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {waiver.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-600 border-emerald-600 hover:bg-emerald-50 h-7 px-2 text-xs"
                          onClick={() => handleMarkWaiverStatus(waiver.id, true)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                          onClick={() => handleMarkWaiverStatus(waiver.id, false)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Decline
                        </Button>
                      </>
                    )}
                    {(waiver.status === "draft" || waiver.status === "pending") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        asChild
                      >
                        <Link to={`/liability-waiver?edit=${waiver.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                    {waiver.status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setDeleteWaiverId(waiver.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWaiverId} onOpenChange={(open) => !open && setDeleteWaiverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Waiver?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The waiver record will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWaiver} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}