import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Check, AlertCircle, User, Watch, ClipboardList, ListTodo } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCreateCustomer } from "@/hooks/use-customers";
import { useCreateWatch } from "@/hooks/use-watches";
import { useAuth } from "@/components/auth/AuthProvider";

export interface QrScanData {
  name: string;
  email: string;
  phone: string;
  referenceNumber: string;
  serialNumber?: string;
  date: string;
  brand: string;
  model: string;
  estimateNumber: string;
  serviceCodes?: string;
  serviceType?: string;
  isBandOnly?: boolean;
  braceletModel?: string;
}

interface MatchedRecord {
  customerId: string;
  customerName: string;
  watchId?: string;
  watchBrand?: string;
  watchModel?: string;
  estimateNumber?: string;
}

interface QrScanResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanData: QrScanData | null;
  matchedRecord: MatchedRecord | null;
  onRecordCreated: () => void;
}

export function QrScanResultDialog({
  open,
  onOpenChange,
  scanData,
  matchedRecord,
  onRecordCreated,
}: QrScanResultDialogProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const createCustomer = useCreateCustomer();
  const createWatch = useCreateWatch();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = React.useState(false);

  // Form state for new customer (when no match found)
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    brand: "",
    model: "",
    referenceNumber: "",
    estimateNumber: "",
  });

  // Sync form with scan data when dialog opens with no match
  React.useEffect(() => {
    if (open && scanData && !matchedRecord) {
      setForm({
        name: scanData.name || "",
        email: scanData.email || "",
        phone: scanData.phone || "",
        brand: scanData.brand || "",
        model: scanData.model || "",
        referenceNumber: scanData.referenceNumber || "",
        estimateNumber: scanData.estimateNumber || "",
      });
    }
  }, [open, scanData, matchedRecord]);

  const handleClose = () => {
    onOpenChange(false);
    setForm({
      name: "",
      email: "",
      phone: "",
      brand: "",
      model: "",
      referenceNumber: "",
      estimateNumber: "",
    });
  };

  // --- Actions for MATCHED records ---
  const handleStartInspection = () => {
    if (!matchedRecord) return;
    handleClose();
    
    // Build URL with customer and watch data
    const params = new URLSearchParams();
    params.set("customerId", matchedRecord.customerId);
    
    if (matchedRecord.watchId) {
      params.set("watchId", matchedRecord.watchId);
    }
    
    // Pass scan data for prefilling watch info (even if watchId exists, scan may have updates)
    if (scanData) {
      if (scanData.brand) params.set("brand", scanData.brand);
      if (scanData.model) params.set("model", scanData.model);
      if (scanData.referenceNumber) params.set("referenceNumber", scanData.referenceNumber);
      if (scanData.estimateNumber) params.set("estimateNumber", scanData.estimateNumber);
      if (scanData.serviceType) params.set("serviceType", scanData.serviceType);
      if (scanData.serviceCodes) params.set("serviceCodes", scanData.serviceCodes);
      if (scanData.serialNumber) params.set("serialNumber", scanData.serialNumber);
      
      // If this is a Band Only scan, trigger bracelet inspection flow
      if (scanData.isBandOnly) {
        params.set("type", "bracelet_only");
        if (scanData.braceletModel) params.set("braceletModel", scanData.braceletModel);
        if (scanData.date) params.set("targetDate", scanData.date);
      }
    }
    
    navigate(`/inspections/new?${params.toString()}`);
  };

  const handleAddToWorkQueue = async () => {
    if (!matchedRecord || !scanData) return;

    setIsAddingToQueue(true);
    try {
      // Check if job already exists for this estimate number
      const { data: existingJob } = await supabase
        .from("jobs")
        .select("id, client_name")
        .eq("estimate_number", scanData.estimateNumber)
        .maybeSingle();

      if (existingJob) {
        // Cross-validate: warn if the existing job belongs to a different customer
        if (existingJob.client_name && matchedRecord.customerName &&
            existingJob.client_name !== matchedRecord.customerName) {
          toast.error(
            `Estimate #${scanData.estimateNumber} already belongs to "${existingJob.client_name}" — cannot assign to "${matchedRecord.customerName}". Please verify the estimate number.`
          );
          setIsAddingToQueue(false);
          return;
        }
        toast.info("Job already exists in work queue");
        handleClose();
        navigate("/work-queue");
        return;
      }

      // Also check if this estimate belongs to a different customer's watch
      const { data: existingWatch } = await supabase
        .from("watches")
        .select("id, customer_id, customers(name)")
        .eq("estimate_number", scanData.estimateNumber)
        .maybeSingle();

      if (existingWatch) {
        const watchCustomer = (existingWatch.customers as any)?.name;
        if (watchCustomer && matchedRecord.customerName &&
            watchCustomer !== matchedRecord.customerName) {
          toast.error(
            `Estimate #${scanData.estimateNumber} belongs to "${watchCustomer}" — cannot assign to "${matchedRecord.customerName}". Please verify the estimate number.`
          );
          setIsAddingToQueue(false);
          return;
        }
      }

      // Create job with waiting_approval status
      const { error } = await supabase.from("jobs").insert({
        client_id: matchedRecord.customerId,
        client_name: matchedRecord.customerName,
        estimate_number: scanData.estimateNumber,
        watch_brand: scanData.brand || matchedRecord.watchBrand,
        watch_model: scanData.model || matchedRecord.watchModel,
        serial_number: scanData.referenceNumber,
        status: "waiting_approval",
        intake_date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;

      toast.success("Added to work queue");
      handleClose();
      navigate("/work-queue?filter=waiting_approval");
    } catch (err: any) {
      toast.error(err.message || "Failed to add to work queue");
    } finally {
      setIsAddingToQueue(false);
    }
  };

  // --- Actions for NEW records ---
  const canSaveNew =
    form.name.trim().length > 0 &&
    form.brand.trim().length > 0 &&
    form.estimateNumber.trim().length > 0;

  const handleSaveNewClient = async () => {
    if (!canSaveNew) return;

    setIsSubmitting(true);
    try {
      // Create customer
      const newCustomer = await createCustomer.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        created_by: session?.user?.id || null,
      });

      // Create watch
      await createWatch.mutateAsync({
        customer_id: newCustomer.id,
        brand: form.brand.trim(),
        model: form.model.trim() || null,
        reference_number: form.referenceNumber.trim() || null,
        estimate_number: form.estimateNumber.trim(),
        target_date: null,
      });

      toast.success("Client and watch created");
      onRecordCreated();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render matched record view
  if (matchedRecord) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Record Found
            </DialogTitle>
            <DialogDescription>
              Choose an action for this client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{matchedRecord.customerName}</span>
              </div>
              {matchedRecord.watchBrand && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Watch className="h-4 w-4" />
                  <span>
                    {matchedRecord.watchBrand}
                    {matchedRecord.watchModel && ` ${matchedRecord.watchModel}`}
                  </span>
                </div>
              )}
              {matchedRecord.estimateNumber && (
                <div className="text-xs text-muted-foreground">
                  Estimate: {matchedRecord.estimateNumber}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={handleStartInspection}
              disabled={isAddingToQueue}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Start Inspection
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleAddToWorkQueue}
              disabled={isAddingToQueue}
            >
              <ListTodo className="mr-2 h-4 w-4" />
              {isAddingToQueue ? "Adding…" : "Add to Work Queue"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render new client form
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            New Client
          </DialogTitle>
          <DialogDescription>
            No matching record found. Review and save to create a new client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Customer
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="qr-name" className="text-xs">
                  Name *
                </Label>
                <Input
                  id="qr-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qr-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="qr-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qr-phone" className="text-xs">
                  Phone
                </Label>
                <Input
                  id="qr-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Watch Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Watch Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="qr-estimate" className="text-xs">
                  Estimate # *
                </Label>
                <Input
                  id="qr-estimate"
                  value={form.estimateNumber}
                  onChange={(e) =>
                    setForm({ ...form, estimateNumber: e.target.value })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qr-reference" className="text-xs">
                  Reference #
                </Label>
                <Input
                  id="qr-reference"
                  value={form.referenceNumber}
                  onChange={(e) =>
                    setForm({ ...form, referenceNumber: e.target.value })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qr-brand" className="text-xs">
                  Brand *
                </Label>
                <Input
                  id="qr-brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qr-model" className="text-xs">
                  Model
                </Label>
                <Input
                  id="qr-model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveNewClient} disabled={!canSaveNew || isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Service code to job type mapping with durations (in weeks)
 * HARDCODED FALLBACK — prefer DB-driven map from fetchServiceCodeMap()
 */
export const SERVICE_CODE_MAP: Record<string, { jobType: string; weeks: number; label: string; isBracelet?: boolean; isMovementService?: boolean }> = {
  'M': { jobType: 'modern_movement', weeks: 4, label: 'Modern', isMovementService: true },
  'M2': { jobType: 'modern_lv2', weeks: 4, label: 'Modern LV2', isMovementService: true },
  'V': { jobType: 'vintage_movement', weeks: 12, label: 'Vintage', isMovementService: true },
  'V2': { jobType: 'vintage_lv2', weeks: 12, label: 'Vintage LV2', isMovementService: true },
  'A': { jobType: 'antique_movement', weeks: 27, label: 'Antique', isMovementService: true },
  'A2': { jobType: 'antique_lv2', weeks: 27, label: 'Antique LV2', isMovementService: true },
  'C': { jobType: 'chrono', weeks: 8, label: 'Chrono', isMovementService: true },
  'C2': { jobType: 'chrono_lv2', weeks: 12, label: 'Chrono LV2', isMovementService: true },
  'CW': { jobType: 'case_work', weeks: 4, label: 'Case Work' },
  'P': { jobType: 'case_work', weeks: 4, label: 'Polish / Case Work' },
  'WR': { jobType: 'warranty', weeks: 4, label: 'Warranty', isMovementService: true },
  'W': { jobType: '', weeks: 0, label: 'Watchmaker Dept (routing only)', isBracelet: false, isMovementService: false },
  'B': { jobType: 'bracelet_work', weeks: 3, label: 'Bracelet', isBracelet: true },
  'BR': { jobType: 'bracelet_repair', weeks: 3, label: 'Bracelet Repair', isBracelet: true },
  'GB': { jobType: 'gold_bracelet', weeks: 6, label: 'Gold Bracelet', isBracelet: true },
  'SR': { jobType: 'stretch_repair', weeks: 3, label: 'Stretch Repair', isBracelet: true },
};

/** Dynamic service code map - set at runtime from DB */
let _dynamicServiceCodeMap: Record<string, { jobType: string; weeks: number; label: string; isBracelet?: boolean; isMovementService?: boolean }> | null = null;

/** Call once at app init or before parsing to load DB codes */
export async function loadServiceCodeMap() {
  try {
    const { fetchServiceCodeMap } = await import("@/hooks/use-service-codes");
    _dynamicServiceCodeMap = await fetchServiceCodeMap();
  } catch (e) {
    console.warn("Failed to load service codes from DB, using hardcoded fallback:", e);
  }
}

/** Get the active service code map (DB-driven if loaded, else hardcoded) */
export function getServiceCodeMap() {
  return _dynamicServiceCodeMap || SERVICE_CODE_MAP;
}

/**
 * Parse comma-separated service codes and return mapped job types
 * Returns the longest duration for target date calculation
 */
export function parseServiceCodes(serviceCodes: string, codeMap?: Record<string, { jobType: string; weeks: number; label: string; isBracelet?: boolean; isMovementService?: boolean }>): {
  services: string[];
  primaryJobType: string | null;
  targetWeeks: number;
} {
  if (!serviceCodes?.trim()) {
    return { services: [], primaryJobType: null, targetWeeks: 4 };
  }

  const map = codeMap || getServiceCodeMap();
  const codes = serviceCodes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const services: string[] = [];
  let maxWeeks = 0;
  let primaryJobType: string | null = null;

  for (const code of codes) {
    // Bare "W" = Watchmaker dept routing only — skip for job type determination
    if (code === 'W') continue;
    const mapping = map[code];
    if (mapping) {
      if (mapping.jobType) services.push(mapping.jobType);
      // Only non-bracelet codes determine the primary (movement) job type
      if (mapping.weeks > maxWeeks && mapping.jobType && !mapping.isBracelet) {
        maxWeeks = mapping.weeks;
        primaryJobType = mapping.jobType;
      }
    } else {
      // Unknown code - keep as-is
      services.push(code);
    }
  }

  return {
    services,
    primaryJobType,
    targetWeeks: maxWeeks || 4,
  };
}

/**
 * Parse the new 9-line newline-delimited QR format from RolliSuite
 * Format (positional, no keys):
 * 1. NAME         → Customer full name
 * 2. EMAIL        → Customer email
 * 3. PHONE        → Customer phone
 * 4. WATCH_REF    → Watch reference/part number
 * 5. WATCH_SERIAL → Watch serial number
 * 6. DATE_IN      → Date received (MM/DD/YYYY)
 * 7. ESTIMATE_NO  → Estimate number
 * 8. SERVICE_CODES→ Comma-separated service codes
 * 9. SERVICE_TYPE → Primary service type code
 */
function parseNewlineFormat(rawData: string): QrScanData | null {
  const lines = rawData.split(/[\r\n]+/).map(line => line.trim());
  
  // Must have at least 7 lines (SERVICE_CODES and SERVICE_TYPE can be empty/missing)
  if (lines.length < 7) {
    return null;
  }

  const [
    name,
    email,
    phone,
    watchRef,
    watchSerial,
    dateIn,
    estimateNo,
    serviceCodes = "",
    serviceType = "",
  ] = lines;

  // Validate we have required fields (name and estimate at minimum)
  if (!name || !estimateNo) {
    return null;
  }

  console.log("QR Parsed newline format:", {
    name, email, phone, watchRef, watchSerial, dateIn, estimateNo, serviceCodes, serviceType
  });

  // Parse service codes to get job types and target weeks
  const { services, primaryJobType, targetWeeks } = parseServiceCodes(serviceCodes);

  return {
    name: name || "",
    email: email || "",
    phone: phone || "",
    referenceNumber: watchRef || "",
    serialNumber: watchSerial || "",
    date: dateIn || "",
    brand: "", // Not in new format - will be looked up from reference
    model: "",
    estimateNumber: estimateNo || "",
    serviceCodes: serviceCodes || "",
    serviceType: serviceType || (primaryJobType || ""),
    isBandOnly: false,
  };
}

// Helper to parse legacy key:value QR format (NAME:value format)
function parseKeyValueFormat(rawData: string): QrScanData | null {
  const lines = rawData.split(/[\r\n]+/).filter(line => line.trim());
  const data: Record<string, string> = {};
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim().toUpperCase();
    const value = line.slice(colonIndex + 1).trim();
    data[key] = value;
  }
  
  // Check if this looks like key:value format (has at least NAME key)
  if (!data['NAME']) {
    return null;
  }
  
  console.log("QR Parsed key:value format:", data);
  
  return {
    name: data['NAME'] || "",
    email: data['EMAIL'] || "",
    phone: data['PHONE'] || "",
    referenceNumber: data['WATCH_REF'] || "",
    serialNumber: data['WATCH_SERIAL'] || "",
    date: data['DATE_IN'] || "",
    brand: "",
    model: "",
    estimateNumber: data['ESTIMATE_NO'] || "",
    serviceCodes: data['SERVICE_CODES'] || "",
    serviceType: data['SERVICE_TYPE'] || "",
    isBandOnly: false,
  };
}

// Normalize date from MM/DD/YY or YYYY-MM-DD to YYYY-MM-DD
function normalizeDateField(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const m = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) {
    const year = parseInt(m[3], 10) + 2000;
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const m2 = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m2) {
    return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  return val;
}

// Helper to parse DataMatrix/PDF417 pipe-delimited format (N:value|E:value|...)
function parsePipeDelimitedFormat(rawData: string): QrScanData | null {
  if (!rawData.includes('|')) return null;

  const fields = rawData.split('|');
  const data: Record<string, string> = {};

  for (const field of fields) {
    const colonIndex = field.indexOf(':');
    if (colonIndex === -1) continue;
    const key = field.slice(0, colonIndex).trim().toUpperCase();
    const value = field.slice(colonIndex + 1).trim();
    data[key] = value;
  }

  // Must have at least name (N) to be valid
  if (!data['N']) return null;

  console.log("Parsed pipe-delimited format:", data);

  const serviceCodes = data['SC'] || '';
  const serviceType = data['ST'] || '';
  const { primaryJobType, services } = parseServiceCodes(serviceCodes);
  const refNumber = data['R'] || '';
  
  // Detect band-only: no reference/service fields OR all service codes are bracelet types
  const noFieldsBandOnly = !refNumber && !serviceType && !serviceCodes;
  const allBracelet = services.length > 0 && services.every(s => {
    const map = getServiceCodeMap();
    const entry = Object.values(map).find(m => m.jobType === s);
    return entry?.isBracelet === true;
  });
  const isBandOnly = noFieldsBandOnly || allBracelet;

  return {
    name: data['N'] || "",
    email: data['E'] || "",
    phone: data['P'] || "",
    referenceNumber: refNumber,
    serialNumber: data['S'] || "",
    date: normalizeDateField(data['D'] || ""),
    brand: isBandOnly ? "Band Only" : "",
    model: "",
    estimateNumber: data['#'] || "",
    serviceCodes,
    serviceType: serviceType || (primaryJobType || ""),
    isBandOnly,
  };
}

// Helper to parse scan data - supports PDF417 pipe, newline, key:value, and legacy caret-delimited
export function parseQrScanData(rawData: string): QrScanData | null {
  const cleanedData = rawData.trim();
  
  console.log("QR Raw data:", JSON.stringify(rawData));
  console.log("QR Cleaned data:", cleanedData);

  // Try PDF417 pipe-delimited format first (N:val|E:val|...)
  if (cleanedData.includes('|')) {
    const result = parsePipeDelimitedFormat(cleanedData);
    if (result) {
      console.log("Detected PDF417 pipe-delimited format");
      return result;
    }
  }
  
  // Check if it's NOT caret-delimited (new format uses newlines)
  const hasCarets = cleanedData.includes('^');
  const hasMultipleLines = cleanedData.includes('\n') || cleanedData.includes('\r');
  
  // Try new 9-line newline format first (no carets, has newlines)
  if (!hasCarets && hasMultipleLines) {
    const result = parseNewlineFormat(cleanedData);
    if (result) {
      console.log("QR Detected new 9-line newline format");
      return result;
    }
  }
  
  // Try key:value format (contains NAME: prefix)
  if (cleanedData.includes('NAME:')) {
    const result = parseKeyValueFormat(cleanedData);
    if (result) {
      console.log("QR Detected key:value format");
      return result;
    }
  }
  
  // Fall back to legacy caret-delimited format
  const parts = cleanedData.replace(/[\r\n\t]/g, "").split("^");
  console.log("QR Parts count:", parts.length, "Parts:", parts);
  
  // Check for "Band Only" format with reference number: Name^Email^Phone^Ref#^Date^Band Only^BraceletModel^EstimateNumber (8 fields)
  if (parts.length === 8 && parts[5]?.trim().toLowerCase() === "band only") {
    const [name, email, phone, referenceNumber, date, , braceletModel, estimateNumber] = parts;
    console.log("QR Detected Band Only format with reference number and bracelet model");
    return {
      name: name?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      referenceNumber: referenceNumber?.trim() || "",
      date: date?.trim() || "",
      brand: "Band Only",
      model: "",
      estimateNumber: estimateNumber?.trim() || "",
      isBandOnly: true,
      braceletModel: braceletModel?.trim() || "",
    };
  }
  
  // Check for "Band Only" format without reference number: Name^Email^Phone^Date^Band Only^BraceletModel^EstimateNumber (7 fields)
  if (parts.length === 7 && parts[4]?.trim().toLowerCase() === "band only") {
    const [name, email, phone, date, , braceletModel, estimateNumber] = parts;
    console.log("QR Detected Band Only format with bracelet model");
    return {
      name: name?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      referenceNumber: "",
      date: date?.trim() || "",
      brand: "Band Only",
      model: "",
      estimateNumber: estimateNumber?.trim() || "",
      isBandOnly: true,
      braceletModel: braceletModel?.trim() || "",
    };
  }
  
  // Check for legacy "Band Only" format: Name^Email^Phone^Date^Band Only^EstimateNumber (6 fields)
  if (parts.length === 6 && parts[4]?.trim().toLowerCase() === "band only") {
    const [name, email, phone, date, , estimateNumber] = parts;
    console.log("QR Detected Band Only format (legacy)");
    return {
      name: name?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      referenceNumber: "",
      date: date?.trim() || "",
      brand: "Band Only",
      model: "",
      estimateNumber: estimateNumber?.trim() || "",
      isBandOnly: true,
    };
  }
  
  // Standard format: Accept 7 parts minimum (Est# is optional)
  if (parts.length < 7) {
    console.error("QR Parse failed: Expected at least 7 parts, got", parts.length);
    return null;
  }

  // 8-field format: Name^Email^Phone^Ref#^Date^Brand^Model^Est#
  // 7-field format (no ref#): Name^Email^Phone^Date^Brand^Model^Est#
  // Detect by checking if field 4 (index 3) looks like a date (YYYY-MM-DD or MM/DD/YYYY)
  const field4 = parts[3]?.trim() || "";
  const looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(field4) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(field4);

  if (parts.length === 7 || (parts.length >= 7 && looksLikeDate && parts.length < 8)) {
    // 7-field: Name^Email^Phone^Date^Brand^Model^Est#
    const [name, email, phone, date, brand, model, estimateNumber = ""] = parts;
    console.log("QR Detected 7-field format (no reference number)");
    return {
      name: name?.trim() || "",
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      referenceNumber: "",
      date: date?.trim() || "",
      brand: brand?.trim() || "",
      model: model?.trim() || "",
      estimateNumber: estimateNumber?.trim() || "",
      isBandOnly: false,
    };
  }

  // 8+ field format: Name^Email^Phone^Ref#^Date^Brand^Model^Est#
  const [name, email, phone, referenceNumber, date, brand, model, estimateNumber = ""] =
    parts;

  return {
    name: name?.trim() || "",
    email: email?.trim() || "",
    phone: phone?.trim() || "",
    referenceNumber: referenceNumber?.trim() || "",
    date: date?.trim() || "",
    brand: brand?.trim() || "",
    model: model?.trim() || "",
    estimateNumber: estimateNumber?.trim() || "",
    isBandOnly: false,
  };
}

// Map SERVICE_TYPE code to job type for inspection form
export function mapServiceTypeToJobType(serviceType: string, serviceCodes?: string): { jobType: string; weeks: number; allJobTypes: string[] } | null {
  const map = getServiceCodeMap();
  const upperCode = serviceType?.toUpperCase().trim() || '';
  
  // Collect ALL job types from service codes
  const allJobTypes: string[] = [];
  
  // First try direct code mapping on serviceType (skip bare W and bracelet-only codes)
  if (map[upperCode] && upperCode !== 'W' && map[upperCode].jobType && !map[upperCode].isBracelet) {
    allJobTypes.push(map[upperCode].jobType);
  }

  // Parse all service codes
  let primaryJobType: string | null = allJobTypes[0] || null;
  let maxWeeks = map[upperCode]?.weeks || 0;
  
  if (serviceCodes) {
    const { services, primaryJobType: scPrimary, targetWeeks } = parseServiceCodes(serviceCodes);
    // Add all parsed job types
    for (const svc of services) {
      if (!allJobTypes.includes(svc)) allJobTypes.push(svc);
    }
    if (targetWeeks > maxWeeks) {
      maxWeeks = targetWeeks;
      primaryJobType = scPrimary;
    }
    if (!primaryJobType) primaryJobType = scPrimary;
  }
  
  // Check for warranty in service codes
  const lowerServiceCodes = serviceCodes?.toLowerCase() || '';
  if (lowerServiceCodes.includes('warranty') || upperCode === 'WARRANTY') {
    if (!allJobTypes.includes('warranty')) allJobTypes.push('warranty');
    if (!primaryJobType) {
      primaryJobType = 'warranty';
      maxWeeks = 4;
    }
  }
  
  // Fallback to legacy string matching
  if (!primaryJobType) {
    const lowerServiceType = serviceType?.toLowerCase() || '';
    const legacyMapping: Record<string, { jobType: string; weeks: number }> = {
      'modern': { jobType: 'modern_movement', weeks: 4 },
      'modern_movement': { jobType: 'modern_movement', weeks: 4 },
      'modern_lv2': { jobType: 'modern_lv2', weeks: 8 },
      'vintage': { jobType: 'vintage_movement', weeks: 12 },
      'vintage_movement': { jobType: 'vintage_movement', weeks: 12 },
      'vintage_lv2': { jobType: 'vintage_lv2', weeks: 16 },
      'antique': { jobType: 'antique_movement', weeks: 27 },
      'antique_movement': { jobType: 'antique_movement', weeks: 27 },
      'antique_lv2': { jobType: 'antique_lv2', weeks: 31 },
      'chrono': { jobType: 'chrono', weeks: 8 },
      'chrono_lv2': { jobType: 'chrono_lv2', weeks: 12 },
      'case_work': { jobType: 'case_work', weeks: 4 },
      'stretch_repair': { jobType: 'stretch_repair', weeks: 4 },
      'bracelet_repair': { jobType: 'bracelet_repair', weeks: 4 },
    };
    const legacy = legacyMapping[lowerServiceType];
    if (legacy) {
      primaryJobType = legacy.jobType;
      maxWeeks = legacy.weeks;
      if (!allJobTypes.includes(legacy.jobType)) allJobTypes.push(legacy.jobType);
    }
  }
  
  if (!primaryJobType) return null;
  
  return { jobType: primaryJobType, weeks: maxWeeks || 4, allJobTypes };
}

/**
 * Get the target date based on service codes (uses longest duration)
 */
export function getTargetDateFromServices(serviceCodes: string, intakeDate?: string): Date {
  const { targetWeeks } = parseServiceCodes(serviceCodes);
  const baseDate = intakeDate ? new Date(intakeDate) : new Date();
  baseDate.setDate(baseDate.getDate() + (targetWeeks * 7));
  return baseDate;
}
