import * as React from "react";
import { ScanLine, Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBarcodeScannerInput } from "@/hooks/use-barcode-scanner-input";
import { supabase } from "@/integrations/supabase/client";
import { findCustomerByEstimate } from "@/hooks/use-jobs";
import { toast } from "sonner";

interface BarcodeScanResult {
  customer: {
    id?: string;
    name: string;
    email: string;
    phone: string;
  };
  watch: {
    brand: string;
    model: string;
    referenceNumber: string;
    estimateNumber: string;
  };
  customerId?: string;
  watchId?: string;
  serviceType?: string;
  serviceCodes?: string;
  braceletModel?: string;
}

interface BarcodeScanDialogProps {
  open: boolean;
  onClose: () => void;
  onScanned: (result: BarcodeScanResult) => void;
}

// Parse pipe-delimited PDF417 barcode data
// Parse caret-delimited format: Name^Email^Phone^Reference^Date^Brand^Model^EstimateNumber
function parseCaretDelimited(raw: string): {
  name: string; email: string; phone: string;
  referenceNumber: string; serialNumber: string;
  estimateNumber: string; serviceCodes: string;
  serviceType: string; date: string; brand: string; model: string;
  braceletModel: string;
} {
  const parts = raw.split("^");
  return {
    name: parts[0]?.trim() || "",
    email: parts[1]?.trim() || "",
    phone: parts[2]?.trim() || "",
    referenceNumber: parts[3]?.trim() || "",
    date: parts[4]?.trim() || "",
    brand: parts[5]?.trim() || "",
    model: parts[6]?.trim() || "",
    estimateNumber: parts[7]?.trim() || "",
    serialNumber: "",
    serviceCodes: "",
    serviceType: "",
    braceletModel: "",
  };
}

// Normalize date from MM/DD/YY or YYYY-MM-DD to YYYY-MM-DD
function normalizeDateField(val: string): string {
  if (!val) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // MM/DD/YY
  const m = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) {
    const year = parseInt(m[3], 10) + 2000;
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  // MM/DD/YYYY
  const m2 = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m2) {
    return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  return val;
}

// Parse pipe-delimited DataMatrix barcode data
// Split on first colon only to preserve email addresses (E:john@example.com)
function parsePipeDelimited(raw: string): {
  name: string; email: string; phone: string;
  referenceNumber: string; serialNumber: string;
  estimateNumber: string; serviceCodes: string;
  serviceType: string; date: string; brand: string; model: string;
  braceletModel: string;
} {
  const result = { name: "", email: "", phone: "", referenceNumber: "", serialNumber: "", estimateNumber: "", serviceCodes: "", serviceType: "", date: "", brand: "", model: "", braceletModel: "" };
  const parts = raw.split("|");
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim().toUpperCase();
    const val = part.slice(colonIdx + 1).trim();
    switch (key) {
      case "N": result.name = val; break;
      case "E": result.email = val; break;
      case "P": result.phone = val; break;
      case "R": result.referenceNumber = val; break;
      case "S": result.serialNumber = val; break;
      case "D": result.date = normalizeDateField(val); break;
      case "#": result.estimateNumber = val; break;
      case "SC": result.serviceCodes = val; break;
      case "ST": result.serviceType = val; break;
      case "BM": result.braceletModel = val; break;
      case "B": result.brand = val; break;
      case "M": result.model = val; break;
    }
  }
  return result;
}

// Parse plain text barcode (e.g. "16233-S462760" = reference-serial)
function parsePlainText(raw: string): {
  name: string; email: string; phone: string;
  referenceNumber: string; serialNumber: string;
  estimateNumber: string; serviceCodes: string;
  serviceType: string; date: string; brand: string; model: string;
  braceletModel: string;
} {
  const result = { name: "", email: "", phone: "", referenceNumber: "", serialNumber: "", estimateNumber: "", serviceCodes: "", serviceType: "", date: "", brand: "", model: "", braceletModel: "" };
  const trimmed = raw.trim();
  
  // Try splitting on hyphen: "16233-S462760" → reference + serial
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-");
    result.referenceNumber = parts[0].trim();
    if (parts.length > 1) {
      result.serialNumber = parts.slice(1).join("-").trim();
    }
  } else {
    // Single token — treat as reference number
    result.referenceNumber = trimmed;
  }
  
  return result;
}

// Auto-detect format and parse
export function parsePdf417(raw: string): {
  name: string; email: string; phone: string;
  referenceNumber: string; serialNumber: string;
  estimateNumber: string; serviceCodes: string;
  serviceType: string; date: string; brand: string; model: string;
  braceletModel: string;
} {
  // Caret-delimited if it contains ^ and no pipe-delimited keys
  if (raw.includes("^") && !raw.includes("|")) {
    return parseCaretDelimited(raw);
  }
  // Pipe-delimited PDF417
  if (raw.includes("|")) {
    return parsePipeDelimited(raw);
  }
  // Plain text fallback (reference number, reference-serial, etc.)
  return parsePlainText(raw);
}

export function BarcodeScanDialog({ open, onClose, onScanned }: BarcodeScanDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleScan = React.useCallback(async (rawData: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const parsed = parsePdf417(rawData);
      
      if (!parsed.name && !parsed.estimateNumber && !parsed.referenceNumber) {
        toast.error("Could not read barcode data. Please try again.");
        setIsProcessing(false);
        return;
      }

      // Try to find existing customer by estimate number
      let resultCustomer = { name: parsed.name, email: parsed.email, phone: parsed.phone, id: undefined as string | undefined };
      let resultWatch = { brand: parsed.brand || "", model: parsed.model || "", referenceNumber: parsed.referenceNumber, estimateNumber: parsed.estimateNumber };
      let foundCustomerId: string | undefined;
      let foundWatchId: string | undefined;

      if (parsed.estimateNumber) {
        const customerMatch = await findCustomerByEstimate(parsed.estimateNumber);
        if (customerMatch) {
          const { data: watchData } = await supabase
            .from("watches")
            .select("*, customers(*)")
            .eq("id", customerMatch.watchId)
            .single();

          if (watchData?.customers) {
            resultCustomer = {
              id: watchData.customers.id,
              name: watchData.customers.name || parsed.name,
              email: watchData.customers.email || parsed.email || "",
              phone: watchData.customers.phone || parsed.phone || "",
            };
            resultWatch = {
              brand: watchData.brand || parsed.brand || "",
              model: parsed.model || "",  // Use scanned model, not existing watch's model
              referenceNumber: parsed.referenceNumber || watchData.reference_number || "",
              estimateNumber: parsed.estimateNumber || "",
            };
            foundCustomerId = watchData.customers.id;
            // Don't set foundWatchId — let save logic decide based on model match
            toast.success(`Found existing client: ${watchData.customers.name}`);
          }
        }
      }

      // If no existing match, try to detect brand/model from reference
      if (!resultWatch.brand && parsed.referenceNumber) {
        const { detectWatchFromReference } = await import("@/lib/watch-constants");
        const detected = detectWatchFromReference(parsed.referenceNumber);
        if (detected) {
          resultWatch.brand = detected.brand;
          resultWatch.model = detected.model;
        } else {
          const { lookupReferenceInDatabase } = await import("@/hooks/use-model-references");
          const dbMatch = await lookupReferenceInDatabase(parsed.referenceNumber);
          if (dbMatch) {
            resultWatch.brand = dbMatch.brand;
            resultWatch.model = dbMatch.model;
          }
        }
      }

      onScanned({
        customer: resultCustomer,
        watch: resultWatch,
        customerId: foundCustomerId,
        watchId: foundWatchId,
        serviceType: parsed.serviceType,
        serviceCodes: parsed.serviceCodes,
        braceletModel: parsed.braceletModel,
      });
    } catch (err: any) {
      console.error("Barcode processing error:", err);
      toast.error("Failed to process barcode data");
      setIsProcessing(false);
    }
  }, [isProcessing, onScanned]);

  useBarcodeScannerInput({
    onScan: handleScan,
    enabled: open && !isProcessing,
    minLength: 5,
  });

  // Reset processing state when dialog opens
  React.useEffect(() => {
    if (open) setIsProcessing(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription>
            Use the barcode scanner to scan the PDF417 label on the watch bag.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-8">
          {isProcessing ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing barcode...</p>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="w-32 h-20 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
                  <ScanLine className="h-10 w-10 text-primary/60 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Ready to scan</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                  <Keyboard className="h-3.5 w-3.5" />
                  Point the barcode scanner at the label
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground">
            Skip — manual entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
