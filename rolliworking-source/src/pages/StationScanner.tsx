import { useState, useCallback, useRef } from "react";
import { ScanLine, CheckCircle2, XCircle, ArrowRight, RotateCcw, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useBarcodeScannerInput } from "@/hooks/use-barcode-scanner-input";
import { toast } from "sonner";

type ScanPhase = "idle" | "job_found" | "processing" | "success" | "error";

const STATUS_PREFIX = "STATUS:";

// Valid statuses that process labels can trigger
const VALID_PROCESS_STATUSES: Record<string, { label: string; color: string }> = {
  uncased: { label: "Uncased", color: "bg-yellow-500" },
  in_progress: { label: "In Progress", color: "bg-blue-500" },
  in_testing: { label: "In Testing", color: "bg-purple-500" },
  finished: { label: "Finished", color: "bg-green-500" },
  parts_approval: { label: "Parts Approval", color: "bg-orange-500" },
  parts_on_order: { label: "Parts On Order", color: "bg-amber-500" },
};

// Printable QR codes for each status
const PRINTABLE_LABELS = Object.entries(VALID_PROCESS_STATUSES).map(([key, val]) => ({
  code: `${STATUS_PREFIX}${key}`,
  label: val.label,
}));

interface FoundJob {
  id: string;
  estimate_number: string;
  watch_brand: string | null;
  watch_model: string | null;
  client_name: string | null;
  status: string;
}

export default function StationScanner() {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [foundJob, setFoundJob] = useState<FoundJob | null>(null);
  const [lastAction, setLastAction] = useState<{ from: string; to: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setFoundJob(null);
    setLastAction(null);
    setErrorMsg("");
  }, []);

  const autoReset = useCallback((delay = 4000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(resetToIdle, delay);
  }, [resetToIdle]);

  // Look up job by estimate number
  const lookupJob = useCallback(async (estimateNumber: string) => {
    // Try jobs table first
    const { data: job } = await supabase
      .from("jobs")
      .select("id, estimate_number, watch_brand, watch_model, client_name, status")
      .eq("estimate_number", estimateNumber)
      .maybeSingle();

    if (job) return job as FoundJob;

    // Fallback: try watches table
    const { data: watch } = await supabase
      .from("watches")
      .select("estimate_number, inspections(jobs(id, estimate_number, watch_brand, watch_model, client_name, status))")
      .eq("estimate_number", estimateNumber)
      .maybeSingle();

    if (watch) {
      const inspections = watch.inspections as any[];
      if (inspections?.[0]?.jobs?.[0]) {
        return inspections[0].jobs[0] as FoundJob;
      }
    }

    return null;
  }, []);

  // Change job status via RPC
  const changeStatus = useCallback(async (jobId: string, newStatus: string) => {
    const { error } = await supabase.rpc("set_job_status", {
      job_id: jobId,
      new_status: newStatus,
    });
    if (error) throw error;
  }, []);

  const handleScan = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    // --- Phase 1: No job loaded yet → treat scan as estimate/reference lookup ---
    if (!foundJob) {
      setPhase("processing");

      // Extract estimate number from various formats
      let estimateNumber = trimmed;

      // If it's a pipe-delimited PDF417, extract #:value
      if (trimmed.includes("|")) {
        const match = trimmed.match(/#:([^|]+)/);
        if (match) estimateNumber = match[1].trim();
      }
      // If it's caret-delimited, estimate is field 8
      if (trimmed.includes("^") && !trimmed.includes("|")) {
        const parts = trimmed.split("^");
        if (parts[7]) estimateNumber = parts[7].trim();
      }

      if (!estimateNumber) {
        setPhase("error");
        setErrorMsg("Could not extract estimate number from scan.");
        autoReset(5000);
        return;
      }

      const job = await lookupJob(estimateNumber);
      if (!job) {
        setPhase("error");
        setErrorMsg(`No job found for estimate #${estimateNumber}`);
        autoReset(5000);
        return;
      }

      setFoundJob(job);
      setPhase("job_found");
      toast.info(`Job found: ${job.client_name || job.estimate_number}`);
      return;
    }

    // --- Phase 2: Job is loaded → treat scan as process label ---
    if (!trimmed.toUpperCase().startsWith(STATUS_PREFIX)) {
      toast.warning("Expected a process label (STATUS:...). Scan a process QR code.");
      return;
    }

    const newStatus = trimmed.slice(STATUS_PREFIX.length).toLowerCase();
    if (!VALID_PROCESS_STATUSES[newStatus]) {
      setPhase("error");
      setErrorMsg(`Invalid status: "${newStatus}"`);
      autoReset(5000);
      return;
    }

    if (foundJob.status === newStatus) {
      toast.info(`Job is already "${VALID_PROCESS_STATUSES[newStatus].label}".`);
      return;
    }

    setPhase("processing");
    try {
      await changeStatus(foundJob.id, newStatus);
      setLastAction({ from: foundJob.status, to: newStatus });
      setPhase("success");
      toast.success(`Status → ${VALID_PROCESS_STATUSES[newStatus].label}`);
      autoReset(4000);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err.message || "Failed to update status");
      autoReset(5000);
    }
  }, [foundJob, lookupJob, changeStatus, autoReset]);

  useBarcodeScannerInput({
    onScan: handleScan,
    enabled: phase !== "processing",
    minLength: 3,
  });

  const statusLabel = (s: string) => VALID_PROCESS_STATUSES[s]?.label || s.replace(/_/g, " ");

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 p-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ScanLine className="h-6 w-6" />
        Station Scanner
      </h1>

      {/* Main scanner card */}
      <Card className="w-full max-w-lg">
        <CardContent className="py-10">
          {phase === "idle" && (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
                <ScanLine className="h-12 w-12 text-muted-foreground animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-medium">Scan Watch Label</p>
                <p className="text-sm text-muted-foreground">
                  Scan the estimate/reference barcode to find the job
                </p>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
              <p className="text-muted-foreground">Processing...</p>
            </div>
          )}

          {phase === "job_found" && foundJob && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
                <p className="text-lg font-semibold">Job Found</p>
              </div>
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimate #</span>
                  <span className="font-mono font-medium">{foundJob.estimate_number}</span>
                </div>
                {foundJob.client_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium">{foundJob.client_name}</span>
                  </div>
                )}
                {(foundJob.watch_brand || foundJob.watch_model) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Watch</span>
                    <span>{[foundJob.watch_brand, foundJob.watch_model].filter(Boolean).join(" ")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Status</span>
                  <Badge variant="outline">{statusLabel(foundJob.status)}</Badge>
                </div>
              </div>
              <div className="text-center space-y-2">
                <ArrowRight className="h-6 w-6 text-primary mx-auto animate-bounce" />
                <p className="text-sm font-medium text-primary">Now scan a Process Label</p>
                <p className="text-xs text-muted-foreground">
                  Scan a station QR code to update the job status
                </p>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={resetToIdle}>
                <RotateCcw className="mr-2 h-4 w-4" /> Start Over
              </Button>
            </div>
          )}

          {phase === "success" && lastAction && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-bold text-green-600">Status Updated!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusLabel(lastAction.from)} → {statusLabel(lastAction.to)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Resetting in a few seconds...
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="text-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive mx-auto" />
              <div>
                <p className="text-lg font-bold text-destructive">Error</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <Button variant="outline" onClick={resetToIdle}>
                <RotateCcw className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Labels Reference */}
      <Button variant="outline" size="sm" onClick={() => setShowLabels(!showLabels)}>
        <Printer className="mr-2 h-4 w-4" />
        {showLabels ? "Hide" : "Show"} Process Label Codes
      </Button>

      {showLabels && (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">Process Label QR Codes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Generate QR codes with these values and place at each workstation.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {PRINTABLE_LABELS.map((label) => (
                <div key={label.code} className="border rounded-lg p-3 text-center space-y-1">
                  <p className="text-sm font-medium">{label.label}</p>
                  <p className="text-xs font-mono text-muted-foreground break-all">{label.code}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
