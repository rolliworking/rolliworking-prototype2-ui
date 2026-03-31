import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Minus, Package, Plus, Save, Send, Search, X, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { useUserRole, canEditJobFields } from "@/hooks/use-user-role";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PartEntry {
  id: string;
  description: string;
  qty: number;
  price: number | null;
  status: "pending" | "approved" | "denied" | "on_order";
  request_number?: string;
  requested_by?: string;
  requested_at?: string;
  priced_by?: string;
  priced_at?: string;
  added_to_template?: boolean;
}

type PartScanTarget = number | null;

interface JobForParts {
  id: string;
  estimate_number: string | null;
  client_name: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  serial_number: string | null;
  status: string;
  parts_requests: PartEntry[] | null;
  parts_approval_status: string | null;
}

// Helper to generate UUID (with fallback for older browsers)
const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for browsers without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const createEmptyParts = (count: number = 4): PartEntry[] =>
  Array.from({ length: count }, () => ({
    id: generateId(),
    description: "",
    qty: 1,
    price: null,
    status: "pending",
  }));

const PartsRequest = () => {
  usePageMeta({
    title: "Parts Request • Rolliworks",
    description: "Create and manage parts requests for jobs",
    canonicalPath: "/parts-request",
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editJobId = searchParams.get("edit");
  
  const queryClient = useQueryClient();
  const { data: userRole } = useUserRole();
  const canPrice = canEditJobFields(userRole);
  
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [partScannerOpen, setPartScannerOpen] = React.useState(false);
  const partScanTargetRef = React.useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<JobForParts | null>(null);
  const [parts, setParts] = React.useState<PartEntry[]>(createEmptyParts());
  const [initialized, setInitialized] = React.useState(false);
  
  // Mobile editor state
  const isMobile = useIsMobile();

  const [editingPartIndex, setEditingPartIndex] = React.useState<number | null>(null);
  const [tempDescription, setTempDescription] = React.useState("");
  const [tempQty, setTempQty] = React.useState(1);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);

  // Prevent iOS/Safari horizontal/zoom weirdness by locking page scroll while the full-screen editor is open.
  React.useEffect(() => {
    if (!isMobile || editingPartIndex === null) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isMobile, editingPartIndex]);

  const { data: jobs, isLoading } = useJobs();
  const updateJob = useUpdateJob();

  // Load job from URL param on mount (only for edit mode from history page)
  React.useEffect(() => {
    if (!editJobId || !jobs || initialized) return;
    
    const found = jobs.find((j: any) => j.id === editJobId);
    if (found) {
      const jobData: JobForParts = {
        id: found.id,
        estimate_number: found.estimate_number,
        client_name: found.client_name,
        watch_brand: found.watch_brand,
        watch_model: found.watch_model,
        serial_number: found.serial_number,
        status: found.status,
        parts_requests: Array.isArray(found.parts_requests) ? found.parts_requests as unknown as PartEntry[] : null,
        parts_approval_status: (found as any).parts_approval_status,
      };
      setSelectedJob(jobData);
      
      // Only load existing parts when in edit mode (from history page)
      const existingParts = jobData.parts_requests;
      if (existingParts && existingParts.length > 0) {
        const merged = [...existingParts];
        while (merged.length < 4) {
          merged.push({
            id: generateId(),
            description: "",
            qty: 1,
            price: null,
            status: "pending",
          });
        }
        setParts(merged);
      }
      setInitialized(true);
    }
  }, [editJobId, jobs, initialized]);

  // Filter jobs based on search query
  const filteredJobs = React.useMemo(() => {
    if (!jobs || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return jobs.filter((j: any) => {
      const name = j.client_name?.toLowerCase() || "";
      const estNum = j.estimate_number?.toLowerCase() || "";
      const refNum = j.serial_number?.toLowerCase() || "";
      return name.includes(q) || estNum.includes(q) || refNum.includes(q);
    }).slice(0, 10); // Limit to 10 results
  }, [jobs, searchQuery]);

  // Handle barcode scan for job lookup - auto-select first match
  const handleJobScan = (code: string) => {
    if (!jobs) return;
    const q = code.toLowerCase().trim();
    const match = jobs.find((j: any) => {
      const estNum = j.estimate_number?.toLowerCase() || "";
      const refNum = j.serial_number?.toLowerCase() || "";
      return estNum === q || refNum === q || estNum.includes(q) || refNum.includes(q);
    });
    
    if (match) {
      selectJob(match);
      toast.success("Job found and selected");
    } else {
      setSearchQuery(code);
      toast.error("No matching job found for scanned code");
    }
  };

  // Manual search button handler
  const handleManualSearch = () => {
    if (searchQuery.trim()) {
      setSearchOpen(true);
    }
  };

  // Select a job from search results - always start fresh for new parts request
  const selectJob = (job: any) => {
    const jobData: JobForParts = {
      id: job.id,
      estimate_number: job.estimate_number,
      client_name: job.client_name,
      watch_brand: job.watch_brand,
      watch_model: job.watch_model,
      serial_number: job.serial_number,
      status: job.status,
      parts_requests: Array.isArray(job.parts_requests) ? job.parts_requests as unknown as PartEntry[] : null,
      parts_approval_status: job.parts_approval_status,
    };
    setSelectedJob(jobData);
    setSearchOpen(false);
    setSearchQuery("");
    
    // Always start with empty parts for new request (don't load existing)
    setParts(createEmptyParts());
    toast.success(`Selected: ${job.client_name || "Unknown client"} - New parts request`);
  };

  // Handle barcode scan for part description
  const handlePartScan = (code: string) => {
    const targetIndex = partScanTargetRef.current;
    if (targetIndex !== null) {
      updatePartDescription(targetIndex, code);
      partScanTargetRef.current = null;
      toast.success("Barcode scanned for part");
    }
  };

  // Open part scanner for specific row
  const openPartScanner = (index: number) => {
    partScanTargetRef.current = index;
    setPartScannerOpen(true);
  };

  // Close part scanner
  const closePartScanner = () => {
    partScanTargetRef.current = null;
    setPartScannerOpen(false);
  };


  // Update part description
  const updatePartDescription = (index: number, description: string) => {
    setParts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description };
      return updated;
    });
  };

  // Update part quantity
  const updatePartQty = (index: number, delta: number) => {
    setParts((prev) => {
      const updated = [...prev];
      const newQty = Math.max(1, updated[index].qty + delta);
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  // Update part price (manager/owner only)
  const updatePartPrice = (index: number, price: string) => {
    if (!canPrice) return;
    setParts((prev) => {
      const updated = [...prev];
      const numPrice = price === "" ? null : parseFloat(price);
      updated[index] = {
        ...updated[index],
        price: numPrice,
        priced_at: new Date().toISOString(),
      };
      return updated;
    });
  };

  // Update part status (manager/owner only)
  const updatePartStatus = (index: number, status: PartEntry["status"]) => {
    if (!canPrice) return;
    setParts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  };

  // Mobile: Open part editor drawer
  const openPartEditor = (index: number) => {
    setEditingPartIndex(index);
    setTempDescription(parts[index].description);
    setTempQty(parts[index].qty);
  };

  // Mobile: Save part from drawer
  const savePartFromDrawer = () => {
    if (editingPartIndex !== null) {
      setParts((prev) => {
        const updated = [...prev];
        updated[editingPartIndex] = {
          ...updated[editingPartIndex],
          description: tempDescription,
          qty: tempQty,
        };
        return updated;
      });
      setEditingPartIndex(null);
    }
  };

  // Mobile: Clear part from drawer
  const clearPartFromDrawer = () => {
    if (editingPartIndex !== null) {
      setParts((prev) => {
        const updated = [...prev];
        updated[editingPartIndex] = {
          ...updated[editingPartIndex],
          description: "",
          qty: 1,
        };
        return updated;
      });
      setEditingPartIndex(null);
    }
  };

  // Filter out empty parts (only new parts without request_number that are empty)
  const getFilledParts = () => parts.filter((p) => p.description.trim() !== "");

  // Get new parts that need a request number assigned
  const getNewParts = () => parts.filter((p) => p.description.trim() !== "" && !p.request_number);

  // Generate unique request number from database
  const generateRequestNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_parts_request_number');
    if (error) throw error;
    return data as string;
  };

  // Save as draft - saves all parts (existing + new)
  const handleSaveDraft = async () => {
    if (!selectedJob) {
      toast.error("Please select a job first");
      return;
    }

    const filledParts = getFilledParts();
    const newParts = getNewParts();
    
    // Generate request numbers for new parts
    let requestNumber: string | null = null;
    if (newParts.length > 0) {
      try {
        requestNumber = await generateRequestNumber();
      } catch (err) {
        console.error("Failed to generate request number:", err);
      }
    }

    const partsWithData = filledParts.map((p) => ({
      ...p,
      request_number: p.request_number || requestNumber || undefined,
      requested_at: p.requested_at || new Date().toISOString(),
    }));

    // In edit mode, the parts state already contains existing + new parts,
    // so just save the current state directly (allows editing existing descriptions)
    const mergedParts = partsWithData;

    // Determine approval status - if any parts are pending/no status, set to draft
    const hasPendingParts = mergedParts.some((p) => p.status === "pending" || !p.status);
    const newApprovalStatus = hasPendingParts ? "draft" : selectedJob.parts_approval_status;

    try {
      await updateJob.mutateAsync({
        id: selectedJob.id,
        parts_requests: mergedParts as any,
        parts_approval_status: newApprovalStatus || "draft",
      });
      toast.success("Parts request saved as draft");
    } catch (err: any) {
      // Fallback to RPC for staff users blocked by RLS
      console.log("Direct update failed, using RPC fallback:", err.message);
      const { error: rpcError } = await supabase.rpc("add_parts_request", {
        _job_id: selectedJob.id,
        _parts_requests: mergedParts as any,
        _parts_approval_status: newApprovalStatus || "draft",
      });
      if (rpcError) {
        toast.error(rpcError.message || "Failed to save draft");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Parts request saved as draft");
    }
  };

  // Submit parts request - saves all parts (existing + new)
  const handleSubmit = async () => {
    if (!selectedJob) {
      toast.error("Please select a job first");
      return;
    }

    const filledParts = getFilledParts();
    if (filledParts.length === 0) {
      toast.error("Please add at least one part");
      return;
    }

    const newParts = getNewParts();
    
    // Generate request numbers for new parts
    let requestNumber: string | null = null;
    if (newParts.length > 0) {
      try {
        requestNumber = await generateRequestNumber();
      } catch (err) {
        console.error("Failed to generate request number:", err);
      }
    }

    const partsWithData = filledParts.map((p) => ({
      ...p,
      request_number: p.request_number || requestNumber || undefined,
      requested_at: p.requested_at || new Date().toISOString(),
    }));

    // In edit mode, the parts state already contains existing + new parts,
    // so just save the current state directly (allows editing existing descriptions)
    const mergedParts = partsWithData;

    // Determine approval status - if any new pending parts, set to pending (needs manager review)
    const hasNewPendingParts = partsWithData.some((p) => p.status === "pending" && !p.added_to_template);
    const newApprovalStatus = hasNewPendingParts ? "pending" : selectedJob.parts_approval_status || "pending";

    try {
      await updateJob.mutateAsync({
        id: selectedJob.id,
        parts_requests: mergedParts as any,
        parts_approval_status: newApprovalStatus,
        status: "parts_approval",
      });
      toast.success(`Parts request ${requestNumber || ""} submitted - Job status changed to Parts Approval`);
      navigate("/work-queue");
    } catch (err: any) {
      // Fallback to RPC for staff users blocked by RLS
      console.log("Direct update failed, using RPC fallback:", err.message);
      const { error: rpcError } = await supabase.rpc("add_parts_request", {
        _job_id: selectedJob.id,
        _parts_requests: mergedParts as any,
        _parts_approval_status: newApprovalStatus,
        _job_status: "parts_approval",
      });
      if (rpcError) {
        toast.error(rpcError.message || "Failed to submit parts request");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Parts request ${requestNumber || ""} submitted - Job status changed to Parts Approval`);
      navigate("/work-queue");
    }
  };

  // Calculate totals
  const filledParts = getFilledParts();
  const totalParts = filledParts.length;
  const pricedParts = filledParts.filter((p) => p.price !== null);
  const totalCost = pricedParts.reduce((sum, p) => sum + (p.price || 0) * p.qty, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parts Request</h1>
          <p className="text-muted-foreground">Scan or search for a job to add parts</p>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Find Job</CardTitle>
          <CardDescription>Scan barcode or enter estimate/reference number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, estimate, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSearch();
                }}
                className="pl-10"
              />
            </div>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button 
                  onClick={handleManualSearch} 
                  variant="secondary"
                  disabled={!searchQuery.trim()}
                >
                  Search
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="end">
                <Command>
                  <CommandList>
                    {filteredJobs.length === 0 ? (
                      <CommandEmpty>No jobs found</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Select a job">
                        {filteredJobs.map((job: any) => (
                          <CommandItem
                            key={job.id}
                            onSelect={() => selectJob(job)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col gap-0.5 w-full">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{job.client_name || "Unknown Client"}</span>
                                <Badge variant="outline" className="text-xs">{job.status}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {job.watch_brand} {job.watch_model}
                                {job.estimate_number && ` • Est: ${job.estimate_number}`}
                                {job.serial_number && ` • Ref: ${job.serial_number}`}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button onClick={() => setScannerOpen(true)} variant="outline">
              <Camera className="h-4 w-4 mr-2" />
              Scan
            </Button>
          </div>

          {selectedJob && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedJob.client_name || "Unknown Client"}</span>
                <Badge variant="outline">{selectedJob.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedJob.watch_brand} {selectedJob.watch_model}
                {selectedJob.serial_number && ` • Ref #: ${selectedJob.serial_number}`}
              </div>
              {selectedJob.estimate_number && (
                <div className="text-sm text-muted-foreground">
                  Estimate: {selectedJob.estimate_number}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Parts on this Job */}
      {selectedJob?.parts_requests && selectedJob.parts_requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              Existing Parts Requests
            </CardTitle>
            <CardDescription>
              Parts already on file for this job
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedJob.parts_requests.map((part: PartEntry, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-sm truncate">{part.description || "Unnamed part"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Qty: {part.qty}</span>
                      {part.price !== null && part.price !== undefined && (
                        <span className="text-foreground font-medium">
                          ${(part.price * part.qty).toFixed(2)}
                        </span>
                      )}
                      {part.request_number && <span>#{part.request_number}</span>}
                    </div>
                  </div>
                  <Badge
                    variant={
                      part.status === "approved" ? "default" :
                      part.status === "denied" ? "destructive" :
                      part.status === "on_order" ? "secondary" :
                      "outline"
                    }
                    className="shrink-0 text-xs"
                  >
                    {part.status || "pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts Entry Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Parts List
          </CardTitle>
        <CardDescription>
            Enter parts needed. Default quantity is 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile: Touch-friendly card list */}
          {isMobile ? (
            <div className="space-y-2">
              {parts.map((part, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => openPartEditor(index)}
                  className="w-full p-4 rounded-lg border bg-card text-left transition-colors hover:bg-muted/50 active:bg-muted min-h-[120px] flex items-center gap-3"
                >
                  <span className="text-lg font-semibold text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  {part.description ? (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{part.description}</p>
                      <p className="text-sm text-muted-foreground">Qty: {part.qty}</p>
                    </div>
                  ) : (
                    <p className="flex-1 text-muted-foreground">Tap to add part...</p>
                  )}
                  {part.description && (
                    <Badge variant="secondary" className="shrink-0">
                      x{part.qty}
                    </Badge>
                  )}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setParts(prev => [...prev, ...createEmptyParts(1)])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>
          ) : (
            /* Desktop: Original grid layout */
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-9 gap-2 text-sm font-medium text-muted-foreground px-1">
                <div className="col-span-1">#</div>
                <div className="col-span-6">Part Description</div>
                <div className="col-span-2 text-center">Qty</div>
              </div>

              {/* Part Rows */}
              {parts.map((part, index) => (
                <div key={index} className="grid grid-cols-9 gap-2 items-center min-h-[72px]">
                  <div className="col-span-1 text-sm text-muted-foreground font-medium">
                    {index + 1}
                  </div>
                  <div className="col-span-6 flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => openPartScanner(index)}
                      title="Scan barcode"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Part name or description..."
                      value={part.description}
                      onChange={(e) => updatePartDescription(index, e.target.value)}
                      className="flex-1 h-14"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updatePartQty(index, -1)}
                      disabled={part.qty <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{part.qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updatePartQty(index, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add Line Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setParts(prev => [...prev, ...createEmptyParts(1)])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
            </div>
          )}

          {/* Summary */}
          {totalParts > 0 && (
            <div className="mt-6 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>Parts requested:</span>
                <span className="font-medium">{totalParts}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions - Sticky on mobile */}
      <div className={`flex gap-3 ${isMobile ? "fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-40" : ""}`}>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={!selectedJob || updateJob.isPending}
          className={isMobile ? "flex-1 h-12" : ""}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button
          onClick={() => setConfirmDialogOpen(true)}
          disabled={!selectedJob || totalParts === 0 || updateJob.isPending}
          className={isMobile ? "flex-1 h-12" : ""}
        >
          <Send className="h-4 w-4 mr-2" />
          Submit
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Parts Submission
            </DialogTitle>
            <DialogDescription>
              Please verify the following parts request before submitting.
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><span className="font-medium">Client:</span> {selectedJob.client_name || "Unknown"}</p>
                <p><span className="font-medium">Watch:</span> {selectedJob.watch_brand} {selectedJob.watch_model}</p>
                {selectedJob.estimate_number && (
                  <p><span className="font-medium">Estimate:</span> {selectedJob.estimate_number}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Parts ({totalParts}):</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {filledParts.map((part, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded border bg-background">
                      <span className="truncate flex-1 mr-2">{part.description}</span>
                      <Badge variant="secondary" className="shrink-0">x{part.qty}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This will set the job status to <strong>Parts Approval</strong>.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmDialogOpen(false);
                handleSubmit();
              }}
              disabled={updateJob.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Mobile spacer for fixed footer */}
      {isMobile && <div className="h-20" />}

      {/* Mobile: Full-screen Part Editor (replaces Drawer) */}
      {isMobile && editingPartIndex !== null && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-overlay/60"
            aria-label="Close part editor"
            onClick={() => setEditingPartIndex(null)}
          />

          <div
            className="absolute inset-0 w-screen max-w-none bg-background flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit part ${editingPartIndex + 1}`}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">Part #{editingPartIndex + 1}</h2>
                <p className="text-xs text-muted-foreground truncate">Enter description and quantity</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setEditingPartIndex(null)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => {
                  partScanTargetRef.current = editingPartIndex;
                  setPartScannerOpen(true);
                }}
              >
                <Camera className="h-5 w-5 mr-3" />
                Scan Barcode
              </Button>

              <div className="space-y-2">
                <label className="text-sm font-medium">Part Description</label>
                <Input
                  placeholder="Enter part name or description..."
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  className="h-14 text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={() => setTempQty(Math.max(1, tempQty - 1))}
                    disabled={tempQty <= 1}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <span className="text-2xl font-bold w-12 text-center">{tempQty}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={() => setTempQty(tempQty + 1)}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="border-t bg-background px-4 pt-3"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex gap-2 w-full">
                <Button
                  variant="destructive"
                  className="flex-1 h-12 min-w-0"
                  onClick={clearPartFromDrawer}
                >
                  <X className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Clear</span>
                </Button>
                <Button
                  className="flex-1 h-12 min-w-0"
                  onClick={savePartFromDrawer}
                >
                  <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Save</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Dialog - Job Lookup */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleJobScan}
      />

      {/* Barcode Scanner Dialog - Part Description */}
      <BarcodeScanner
        open={partScannerOpen}
        onClose={closePartScanner}
        onScan={(code) => {
          if (editingPartIndex !== null) {
            setTempDescription(code);
          }
          handlePartScan(code);
        }}
      />
    </div>
  );
};

export default PartsRequest;
