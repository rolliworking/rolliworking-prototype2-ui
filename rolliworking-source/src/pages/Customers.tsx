import * as React from "react";
import { format } from "date-fns";
import { Search, Plus, Pencil, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ScanBarcode } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { usePageMeta } from "@/hooks/use-page-meta";
import { useCustomersPaginated, useUpdateCustomer, CUSTOMERS_PAGE_SIZE } from "@/hooks/use-customers";
import { useWatchesByCustomer } from "@/hooks/use-watches";
import { useUserRole, canEditJobFields } from "@/hooks/use-user-role";
import { useBarcodeScannerInput } from "@/hooks/use-barcode-scanner-input";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  QrScanResultDialog,
  parseQrScanData,
  type QrScanData,
} from "@/components/clients/QrScanResultDialog";

function CustomerWatches({ customerId }: { customerId: string }) {
  const { data: watches, isLoading } = useWatchesByCustomer(customerId);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!watches || watches.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No watches on file for this customer.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estimate #</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Target Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {watches.map((watch) => (
          <TableRow key={watch.id}>
            <TableCell className="font-medium">{watch.estimate_number}</TableCell>
            <TableCell>{watch.brand}</TableCell>
            <TableCell>{watch.model || "—"}</TableCell>
            <TableCell>{watch.reference_number || "—"}</TableCell>
            <TableCell>
              {watch.target_date
                ? format((() => { const [y,m,d] = watch.target_date.split("-").map(Number); return new Date(y, m-1, d); })(), "MMM d, yyyy")
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const Customers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [pageInput, setPageInput] = React.useState("");

  // QR scan state
  const [scanDialogOpen, setScanDialogOpen] = React.useState(false);
  const [scanData, setScanData] = React.useState<QrScanData | null>(null);
  const [matchedRecord, setMatchedRecord] = React.useState<{
    customerId: string;
    customerName: string;
    watchId?: string;
    watchBrand?: string;
    watchModel?: string;
    estimateNumber?: string;
  } | null>(null);

  // Get page from URL params
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Role gate: sync is for manager/owner only
  const { data: userRole, isLoading: isRoleLoading } = useUserRole();
  const canSync = isRoleLoading ? true : canEditJobFields(userRole);

  // Edit modal state
  const [editingCustomer, setEditingCustomer] = React.useState<{
    id: string;
    name: string;
    email: string | null;
  } | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");

  const updateCustomer = useUpdateCustomer();

  usePageMeta({
    title: "Clients • Rolliworks",
    description: "Search clients and watch records in the Rolliworks watch repair dashboard.",
    canonicalPath: "/clients",
  });

  // Handle barcode scanner input
  const handleBarcodeScan = React.useCallback(async (rawData: string) => {
    const parsed = parseQrScanData(rawData);
    if (!parsed) {
      toast.error("Invalid QR format. Expected key:value format or legacy Name^Email^Phone^Ref#^Date^Brand^Model format");
      return;
    }

    // ALWAYS check for existing record by estimate number first (prevents duplicate customers)
    if (parsed.estimateNumber) {
      // Check watches table
      const { data: watchMatch } = await supabase
        .from("watches")
        .select("id, customer_id, brand, model, estimate_number, customers(id, name, email)")
        .eq("estimate_number", parsed.estimateNumber)
        .maybeSingle();

      if (watchMatch && watchMatch.customers) {
        const customer = watchMatch.customers as { id: string; name: string; email: string | null };
        
        // For Band Only scans with matched record, open dialog with matched customer
        if (parsed.isBandOnly) {
          setMatchedRecord({
            customerId: customer.id,
            customerName: customer.name,
            watchId: watchMatch.id,
            watchBrand: watchMatch.brand,
            watchModel: watchMatch.model || undefined,
            estimateNumber: watchMatch.estimate_number,
          });
          setScanData(parsed);
          setScanDialogOpen(true);
          toast.success("Existing customer found for this estimate!");
          return;
        }

        // Standard watch scan - use existing matched record flow
        setMatchedRecord({
          customerId: customer.id,
          customerName: customer.name,
          watchId: watchMatch.id,
          watchBrand: watchMatch.brand,
          watchModel: watchMatch.model || undefined,
          estimateNumber: watchMatch.estimate_number,
        });
        setScanData(parsed);
        setScanDialogOpen(true);
        toast.success("Record found!");
        return;
      }

      // Also check jobs table for estimate number
      const { data: jobMatch } = await supabase
        .from("jobs")
        .select("id, client_id, client_name, watch_brand, watch_model, estimate_number, customers(id, name, email)")
        .eq("estimate_number", parsed.estimateNumber)
        .maybeSingle();

      if (jobMatch && jobMatch.customers) {
        const customer = jobMatch.customers as { id: string; name: string; email: string | null };
        
        // For Band Only scans with matched job
        if (parsed.isBandOnly) {
          setMatchedRecord({
            customerId: customer.id,
            customerName: customer.name,
            watchBrand: jobMatch.watch_brand || undefined,
            watchModel: jobMatch.watch_model || undefined,
            estimateNumber: jobMatch.estimate_number || undefined,
          });
          setScanData(parsed);
          setScanDialogOpen(true);
          toast.success("Existing customer found for this estimate!");
          return;
        }

        setMatchedRecord({
          customerId: customer.id,
          customerName: customer.name,
          watchBrand: jobMatch.watch_brand || undefined,
          watchModel: jobMatch.watch_model || undefined,
          estimateNumber: jobMatch.estimate_number || undefined,
        });
        setScanData(parsed);
        setScanDialogOpen(true);
        toast.success("Record found from job!");
        return;
      }
    }

    // Handle "Band Only" scans with NO existing record - navigate directly to bracelet inspection
    if (parsed.isBandOnly) {
      toast.success("Band Only label detected - opening bracelet inspection");
      const params = new URLSearchParams();
      params.set("type", "bracelet_only");
      params.set("name", parsed.name);
      if (parsed.email) params.set("email", parsed.email);
      if (parsed.phone) params.set("phone", parsed.phone);
      if (parsed.estimateNumber) params.set("estimateNumber", parsed.estimateNumber);
      if (parsed.date) params.set("targetDate", parsed.date);
      if (parsed.braceletModel) params.set("braceletModel", parsed.braceletModel);
      if (parsed.referenceNumber) params.set("referenceNumber", parsed.referenceNumber);
      navigate(`/inspections/new?${params.toString()}`);
      return;
    }

    setScanData(parsed);

    // Try to find by customer name + email
    if (parsed.name) {
      let query = supabase
        .from("customers")
        .select("id, name, email")
        .ilike("name", parsed.name.trim());

      if (parsed.email) {
        query = query.ilike("email", parsed.email.trim());
      }

      const { data: customerMatch } = await query.maybeSingle();

      if (customerMatch) {
        setMatchedRecord({
          customerId: customerMatch.id,
          customerName: customerMatch.name,
        });
        setScanDialogOpen(true);
        toast.success("Customer found!");
        return;
      }
    }

    // No match found - show form to create new
    setMatchedRecord(null);
    setScanDialogOpen(true);
    toast.info("New client - review and save");
  }, [navigate]);

  useBarcodeScannerInput({
    onScan: handleBarcodeScan,
    minLength: 10,
    enabled: !scanDialogOpen, // Disable while dialog is open
  });

  const handleRecordCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  // Debounce search and reset page
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      // Reset to page 1 when search changes
      if (search !== debouncedSearch) {
        setSearchParams((prev) => {
          prev.delete("page");
          return prev;
        });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, error, isFetching } = useCustomersPaginated(debouncedSearch, currentPage);

  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;
  const customers = data?.customers || [];

  // Update page input when page changes
  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setSearchParams((prev) => {
      if (validPage === 1) {
        prev.delete("page");
      } else {
        prev.set("page", String(validPage));
      }
      return prev;
    });
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput, 10);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  const handleSyncFromRolliSuite = async () => {
    if (!canSync) {
      toast.error("Only managers can run client sync");
      return;
    }

    setIsSyncing(true);
    try {
      const filter = search.trim();
      const { data, error } = await supabase.functions.invoke(
        "rollisuite-customer-sync",
        {
          method: "POST",
          body: filter ? { filter } : {},
        }
      );

      if (error) {
        console.error("Sync error:", error);
        toast.error(`Sync failed: ${error.message}`);
        return;
      }

      if (data?.warning) {
        toast.warning(data.warning);
      }

      if (data?.success) {
        toast.success(data.message || "Sync complete");
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else {
        toast.error(data?.error || "Sync failed");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(err.message || "Failed to sync customers");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditClick = (customer: { id: string; name: string; email: string | null }) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditEmail(customer.email || "");
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: editingCustomer.id,
        name: editName.trim(),
        email: editEmail.trim() || null,
      });
      toast.success("Client updated");
      setEditingCustomer(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update client");
    }
  };

  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * CUSTOMERS_PAGE_SIZE, totalCount);

  return (
    <main className="space-y-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} clients total •{" "}
            <span className="text-primary inline-flex items-center gap-1">
              <ScanBarcode className="h-3 w-3" />
              Scan RS label to intake
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromRolliSuite}
            disabled={isSyncing || !canSync}
            title={!canSync ? "Manager access required" : undefined}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing…" : "Sync from RS"}
          </Button>
          <Button size="sm" onClick={() => navigate("/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{showingFrom}–{showingTo}</span> of{" "}
          <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1 || isLoading}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 px-1">
            <Input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              className="h-7 w-12 text-center text-xs px-1"
              onBlur={() => setPageInput(String(currentPage))}
            />
            <span className="text-xs text-muted-foreground">of {totalPages}</span>
          </form>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load clients</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search ? "No clients match your search." : "No clients yet."}
        </p>
      ) : (
        <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
          <Accordion type="single" collapsible className="space-y-1">
            {customers.map((customer) => (
              <AccordionItem
                key={customer.id}
                value={customer.id}
                className="rounded-lg border border-border bg-card px-3"
              >
                <AccordionTrigger className="hover:no-underline py-2">
                  <div className="flex flex-1 items-center justify-between gap-3 text-left pr-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[customer.email, customer.phone].filter(Boolean).join(" • ") || "No contact info"}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(customer);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <CustomerWatches customerId={customer.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <form onSubmit={handlePageInputSubmit} className="inline-flex">
              <Input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
                className="h-7 w-14 text-center text-sm px-1"
                onBlur={() => setPageInput(String(currentPage))}
              />
            </form>
            <span className="text-sm text-muted-foreground">of {totalPages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomer(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scan Result Dialog */}
      <QrScanResultDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        scanData={scanData}
        matchedRecord={matchedRecord}
        onRecordCreated={handleRecordCreated}
      />
    </main>
  );
};

export default Customers;
