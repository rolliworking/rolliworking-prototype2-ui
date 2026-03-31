import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Camera, Loader2, FileCheck, ScanLine, Settings2, ScanBarcode, Layers } from "lucide-react";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { ScantronCamera } from "@/components/inspection/ScantronCamera";
import { ScantronTemplateManager } from "@/components/inspection/ScantronTemplateManager";
import { ScannerControlPanel } from "@/components/scanner/ScannerControlPanel";
import { useBarcodeScannerInput } from "@/hooks/use-barcode-scanner-input";
import { parsePdf417 } from "@/components/inspection/BarcodeScanDialog";
import { BarcodeConfirmDialog, type BarcodeConfirmData } from "@/components/inspection/BarcodeConfirmDialog";
import { loadServiceCodeMap } from "@/components/clients/QrScanResultDialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getActiveTemplateUrl } from "@/hooks/use-scantron-templates";
import { useScantronQueue, type QueuedPage } from "@/hooks/use-scantron-queue";

import { formatDateLocal, getWeeksToTargetFromDate, resolveTargetDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import { detectWatchFromReference } from "@/lib/watch-constants";
import { lookupReferenceInDatabase } from "@/hooks/use-model-references";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCreateCustomer } from "@/hooks/use-customers";
import { useCreateWatch, useUpdateWatch } from "@/hooks/use-watches";
import { useInspections, useCreateInspection, useUpdateInspection, INSPECTION_TYPES } from "@/hooks/use-inspections";
import { useUpsertJob, findWatchByEstimateOrReference, findCustomerByEstimate } from "@/hooks/use-jobs";
import { useTrackNoteUsage } from "@/hooks/use-note-usage";
import { CustomerForm } from "@/components/inspection/CustomerForm";
import { 
  InspectionForm, 
  type ExpandedInspectionFormData,
  type BraceletItemData,
  emptyExpandedInspectionData 
} from "@/components/inspection/InspectionForm";
import { emptySectionCondition } from "@/components/inspection/InspectionSection";
import { ClientApprovalPanel } from "@/components/inspection/ClientApprovalPanel";

type Step = "customer" | "inspection";

const STEPS: { key: Step; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "inspection", label: "Watch & Inspection" },
];


const NewInspection = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const prefillCustomerId = searchParams.get("customerId");
  const prefillWatchId = searchParams.get("watchId");
  // Watch data from QR scan
  const prefillBrand = searchParams.get("brand");
  const prefillModel = searchParams.get("model");
  const prefillReferenceNumber = searchParams.get("referenceNumber");
  const prefillEstimateNumber = searchParams.get("estimateNumber");
  const prefillServiceType = searchParams.get("serviceType"); // From new QR format
  const prefillServiceCodes = searchParams.get("serviceCodes"); // Comma-separated service codes
  // Band Only scan parameters
  const prefillType = searchParams.get("type"); // "bracelet_only" for band scans
  const prefillName = searchParams.get("name");
  const prefillEmail = searchParams.get("email");
  const prefillPhone = searchParams.get("phone");
  const prefillTargetDate = searchParams.get("targetDate");
  const prefillBraceletModel = searchParams.get("braceletModel");
  
  const isEditMode = !!editId;
  // Consider prefilled if we have customerId OR band only type with name
  const isPrefilled = !!prefillCustomerId || (prefillType === "bracelet_only" && !!prefillName);

  // Load DB-driven service codes on mount
  React.useEffect(() => { loadServiceCodeMap(); }, []);

  const { data: allInspections } = useInspections();

  usePageMeta({
    title: isEditMode ? "Edit Inspection • Rolliworks" : "New Inspection • Rolliworks",
    description: "Start a new watch inspection in the Rolliworks watch repair dashboard.",
    canonicalPath: isEditMode ? `/inspections/new?edit=${editId}` : "/inspections/new",
  });

  const [step, setStep] = React.useState<Step>(isPrefilled ? "inspection" : "customer");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [scantronDragOver, setScantronDragOver] = React.useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = React.useState(false);
  
  const [templateManagerOpen, setTemplateManagerOpen] = React.useState(false);
  const [scannerPanelOpen, setScannerPanelOpen] = React.useState(false);
  const [pendingUploads, setPendingUploads] = React.useState<Array<{ id: string; filename: string; storage_path: string; created_at: string }>>([]);
  const [draftId, setDraftId] = React.useState<string | null>(editId);
  const [pendingBarcodeConfirm, setPendingBarcodeConfirm] = React.useState<BarcodeConfirmData | null>(null);

  // Batch queue for multi-page PDF scans
  const {
    isActive: queueIsActive,
    doneCount: queueDoneCount,
    totalCount: queueTotalCount,
    currentIndex: queueCurrentIndex,
    markCurrentDone,
    markCurrentSkipped,
    advanceToNext,
  } = useScantronQueue();
  
  const [watchId, setWatchId] = React.useState<string | null>(prefillWatchId);
  const [customerId, setCustomerId] = React.useState<string | null>(prefillCustomerId);
  
  const [prefillLoaded, setPrefillLoaded] = React.useState(false);
  const [useHtmlEmail, setUseHtmlEmail] = React.useState(true);
  // Customer data
  const [customer, setCustomer] = React.useState<{
    id?: string;
    name: string;
    email: string;
    phone?: string;
  }>({
    id: prefillCustomerId || undefined,
    name: "",
    email: "",
    phone: "",
  });

  // Watch data
  const [watch, setWatch] = React.useState({
    brand: "",
    model: "",
    referenceNumber: "",
    estimateNumber: "",
  });

  // Inspection data - using expanded form
  const [inspection, setInspection] = React.useState<ExpandedInspectionFormData>(
    emptyExpandedInspectionData()
  );

  // Clear all inspection data
  const handleClearInspection = React.useCallback(() => {
    setInspection(emptyExpandedInspectionData());
  }, []);

  const createCustomer = useCreateCustomer();
  const createWatch = useCreateWatch();
  const updateWatch = useUpdateWatch();
  const createInspection = useCreateInspection();
  const updateInspection = useUpdateInspection();
  const upsertJob = useUpsertJob();
  const trackNoteUsage = useTrackNoteUsage();

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // Build model string with multi-item prefix (e.g. "1 of 5 Jubilee")
  // Falls back to auto-detection from reference number when model is empty
  const getModelWithItemPrefix = React.useCallback(() => {
    let baseModel = watch.model.trim();
    
    // Auto-detect model from reference number if model is empty
    if (!baseModel && watch.referenceNumber.trim()) {
      const detected = detectWatchFromReference(watch.referenceNumber);
      if (detected) {
        baseModel = detected.model;
      }
    }
    
    if (inspection.totalItems && inspection.totalItems > 1 && inspection.currentItemNumber) {
      const prefix = `${inspection.currentItemNumber} of ${inspection.totalItems}`;
      // Don't double-prefix if model already starts with "X of Y"
      if (/^\d+ of \d+/.test(baseModel)) return baseModel;
      return prefix + (baseModel ? ` ${baseModel}` : "");
    }
    return baseModel;
  }, [watch.model, watch.referenceNumber, inspection.totalItems, inspection.currentItemNumber]);

  // Store original target date when editing (so we don't erase past dates)
  const originalTargetDateRef = React.useRef<string | null>(null);

  // Track whether the user manually changed weeksToTarget from the loaded value
  const loadedWeeksRef = React.useRef<number | null>(null);

  // Calculate target date from weeks/custom date using stable local-date math
  const targetDate = React.useMemo(() => {
    return resolveTargetDate({
      customTargetDate: inspection.customTargetDate,
      originalTargetDate: originalTargetDateRef.current,
      initialWeeksToTarget: loadedWeeksRef.current,
      weeksToTarget: inspection.weeksToTarget,
    });
  }, [inspection.weeksToTarget, inspection.customTargetDate]);

  // Convert SectionConditionData to jsonb format for storage - store ALL details
  const formatConditionForDb = (condition: typeof inspection.dialCondition): Record<string, unknown> => ({
    condition: condition.condition,
    selectedNotes: condition.selectedNotes,
    customNote: condition.customNote,
    customNotePrice: condition.customNotePrice || 0,
    customNoteAddYesNo: condition.customNoteAddYesNo || false,
    additionalNotes: (condition.additionalNotes || []).map(n => ({
      note: n.note,
      price: n.price,
      addYesNo: n.addYesNo,
    })),
    price: condition.price || 0,
    waiverRequired: condition.waiverRequired || false,
    // Legacy fields for compatibility
    notes: [...condition.selectedNotes, condition.customNote].filter(Boolean).join("; "),
    waiver_required: condition.waiverRequired || false,
  });

  // Build full inspection data for saving
  // When braceletItemOverride is provided, use that item's bracelet data instead of the top-level
  const buildInspectionData = (status: string, braceletItemOverride?: BraceletItemData) => ({
    inspection_type: inspection.inspectionType,
    job_type: inspection.jobType || "general_repair",
    job_types: (() => {
      const types = inspection.jobTypes.length > 0 ? [...inspection.jobTypes] : [];
      // Always ensure the primary jobType is included
      if (inspection.jobType && !types.includes(inspection.jobType)) {
        types.unshift(inspection.jobType);
      }
      return types.length > 0 ? types : (inspection.jobType ? [inspection.jobType] : []);
    })(),
    crystal_condition: formatConditionForDb(inspection.crystalCondition) as any,
    dial_condition: formatConditionForDb(inspection.dialCondition) as any,
    hands_condition: formatConditionForDb(inspection.handsCondition) as any,
    crown_condition: formatConditionForDb(inspection.crownCondition) as any,
    bezel_condition: formatConditionForDb(inspection.bezelCondition) as any,
    case_condition: {
      ...formatConditionForDb(inspection.caseCondition),
      restore_price: inspection.caseRestorePrice || 0,
      restore_add_yes_no: inspection.caseRestoreAddYesNo || false,
      welding_price: inspection.weldingPrice || 0,
    } as any,
    bracelet_condition: {
      ...formatConditionForDb(braceletItemOverride?.braceletCondition || inspection.braceletCondition),
      repair_details: JSON.parse(JSON.stringify(braceletItemOverride?.braceletRepair || inspection.braceletRepair)),
      watch_head_restore_price: (braceletItemOverride?.watchHeadRestorePrice ?? inspection.watchHeadRestorePrice) || 0,
      gaskets_price: (braceletItemOverride?.gasketsPrice ?? inspection.gasketsPrice) || 0,
    } as any,
    notes: inspection.miscNotes.trim() || null,
    pricing_details: {
      miscNotesPrice: inspection.miscNotesPrice || 0,
      miscNotesAddYesNo: inspection.miscNotesAddYesNo || false,
    } as any,
    waiver_required: inspection.waiverRequired,
    waiver_signed: inspection.waiverSigned,
    total_estimate: inspection.totalEstimate,
    use_html_email: useHtmlEmail,
    department_tag: (inspection.departmentTags && inspection.departmentTags.length > 0) ? inspection.departmentTags.join(",") : null,
    status,
    created_by: session?.user?.id || null,
  });

  // Fire-and-forget: upsert reference → brand/model to model_references library
  const saveToReferenceLibrary = React.useCallback(async () => {
    const ref = watch.referenceNumber?.split("-")[0]?.trim().toUpperCase();
    const brand = watch.brand?.trim();
    if (!ref || !brand) return;
    try {
      await supabase
        .from("model_references")
        .upsert(
          {
            part_number: ref,
            brand,
            model: watch.model?.trim() || null,
            source: "portal",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "part_number" }
        );
    } catch {
      // Silent — fire-and-forget
    }
  }, [watch.referenceNumber, watch.brand, watch.model]);

  // Save inspection and return the inspection ID (without resetting form)
  const saveInspectionForEmail = React.useCallback(async (): Promise<string> => {
    // Auto-resolve model from reference if still empty (async DB lookup fallback)
    if (!watch.model.trim() && watch.referenceNumber.trim()) {
      const detected = detectWatchFromReference(watch.referenceNumber);
      if (detected) {
        setWatch(prev => ({ ...prev, model: detected.model }));
      } else {
        const dbMatch = await lookupReferenceInDatabase(watch.referenceNumber);
        if (dbMatch?.model) {
          setWatch(prev => ({ ...prev, model: dbMatch.model }));
        }
      }
    }

    const isMultiItemMode = inspection.braceletItems && inspection.braceletItems.length > 1;

    // Check for existing job by estimate/reference number before creating (single-item only)
    if (!isMultiItemMode && !isEditMode && !watchId && watch.estimateNumber.trim()) {
      const existing = await findWatchByEstimateOrReference(
        watch.estimateNumber.trim(),
        watch.referenceNumber.trim(),
        watch.model.trim()
      );
      
      if (existing?.hasJob && existing.jobId) {
        toast.info("A job already exists for this estimate/reference number. Opening for editing.");
        navigate(`/new-job?edit=${existing.jobId}`);
        throw new Error("Redirecting to existing job");
      }
    }

    // Ensure we have saved customer
    let savedCustomerId = customerId;
    if (!savedCustomerId) {
      if (customer.id) {
        savedCustomerId = customer.id;
      } else {
        const newCustomer = await createCustomer.mutateAsync({
          name: customer.name.trim(),
          email: customer.email.trim() || null,
          created_by: session?.user?.id || null,
        });
        savedCustomerId = newCustomer.id;
        setCustomerId(savedCustomerId);
      }
    }

    if (!savedCustomerId) {
      throw new Error("Could not save - customer info required");
    }

    const targetDateStr = targetDate ? formatDateLocal(targetDate) : null;

    // ─── MULTI-ITEM SAVE ───
    if (isMultiItemMode) {
      let firstInspectionId: string | null = null;
      const totalItems = inspection.braceletItems!.length;
      const updatedItems = [...inspection.braceletItems!];

      for (let idx = 0; idx < totalItems; idx++) {
        const item = updatedItems[idx];
        const itemPrefix = `${idx + 1} of ${totalItems}`;
        const modelStr = itemPrefix + (item.model.trim() ? ` ${item.model.trim()}` : "");

        let itemWatchId = item.savedWatchId || null;

        if (itemWatchId) {
          await updateWatch.mutateAsync({
            id: itemWatchId,
            brand: watch.brand.trim(),
            model: modelStr,
            target_date: targetDateStr,
          });
        } else {
          const existingCheck = await findWatchByEstimateOrReference(
            watch.estimateNumber.trim(),
            "",
            modelStr
          );

          if (existingCheck) {
            itemWatchId = existingCheck.watchId;
            await updateWatch.mutateAsync({
              id: itemWatchId,
              brand: watch.brand.trim(),
              model: modelStr,
              target_date: targetDateStr,
            });
          } else {
            const newWatch = await createWatch.mutateAsync({
              customer_id: savedCustomerId,
              brand: watch.brand.trim(),
              model: modelStr,
              reference_number: null,
              estimate_number: watch.estimateNumber.trim(),
              target_date: targetDateStr,
            });
            itemWatchId = newWatch.id;
          }
        }

        // Create or update inspection for this item
        let inspId: string;
        if (item.savedInspectionId) {
          await updateInspection.mutateAsync({
            id: item.savedInspectionId,
            watch_id: itemWatchId,
            ...buildInspectionData("sent", item),
          });
          inspId = item.savedInspectionId;
        } else {
          const newInspection = await createInspection.mutateAsync({
            watch_id: itemWatchId,
            ...buildInspectionData("sent", item),
          });
          inspId = newInspection.id;
          updatedItems[idx] = { ...item, savedWatchId: itemWatchId!, savedInspectionId: inspId };
        }

        if (idx === 0) firstInspectionId = inspId;
      }

      // Store IDs back so next save updates instead of duplicating
      setInspection(prev => ({ ...prev, braceletItems: updatedItems }));
      toast.success(`${totalItems} bracelet inspections saved and marked as sent`);
      return firstInspectionId!;
    }

    // ─── SINGLE ITEM SAVE (original logic) ───
    let savedWatchId = watchId;
    
    if (!savedWatchId) {
      // Check for existing watch to prevent constraint violation
      const existingCheck = await findWatchByEstimateOrReference(
        watch.estimateNumber.trim(),
        watch.referenceNumber.trim(),
        watch.model.trim()
      );
      
      if (existingCheck) {
        savedWatchId = existingCheck.watchId;
        await updateWatch.mutateAsync({
          id: savedWatchId,
          brand: watch.brand.trim() || "Unknown",
           model: getModelWithItemPrefix() || null,
          reference_number: watch.referenceNumber.trim() || null,
          target_date: targetDateStr,
        });
      } else {
        const newWatch = await createWatch.mutateAsync({
          customer_id: savedCustomerId,
          brand: watch.brand.trim() || "Unknown",
           model: getModelWithItemPrefix() || null,
          reference_number: watch.referenceNumber.trim() || null,
          estimate_number: watch.estimateNumber.trim() || `SENT-${Date.now()}`,
          target_date: targetDateStr,
        });
        savedWatchId = newWatch.id;
      }
      setWatchId(savedWatchId);
    } else {
      await updateWatch.mutateAsync({
        id: savedWatchId,
        brand: watch.brand.trim() || "Unknown",
         model: getModelWithItemPrefix() || null,
        reference_number: watch.referenceNumber.trim() || null,
        estimate_number: watch.estimateNumber.trim(),
        target_date: targetDateStr,
      });
    }

    // Save reference → brand/model to library (fire-and-forget)
    saveToReferenceLibrary();

    // Save or update inspection with "sent" status
    let savedInspectionId = draftId;
    if (!draftId) {
      const newInspection = await createInspection.mutateAsync({
        watch_id: savedWatchId,
        ...buildInspectionData("sent"),
      });
      savedInspectionId = newInspection.id;
      setDraftId(newInspection.id);
    } else {
      await updateInspection.mutateAsync({
        id: draftId,
        ...buildInspectionData("sent"),
      });
    }

    // Track note usage for each section (fire-and-forget)
    const trackUsage = async () => {
      const sections = [
        { key: "dial", data: inspection.dialCondition },
        { key: "hands", data: inspection.handsCondition },
        { key: "bezel", data: inspection.bezelCondition },
        { key: "crown", data: inspection.crownCondition },
        { key: "case", data: inspection.caseCondition },
        { key: "crystal", data: inspection.crystalCondition },
        { key: "bracelet", data: inspection.braceletCondition },
      ];
      
      for (const { key, data } of sections) {
        const notesUsed = [...data.selectedNotes];
        if (data.customNote?.trim()) {
          notesUsed.push(data.customNote.trim());
        }
        if (notesUsed.length > 0) {
          trackNoteUsage.mutate({ section: key, notes: notesUsed });
        }
      }
    };
    trackUsage();

    // For complete watch or case work inspections, upsert job
    const shouldCreateJob = inspection.inspectionType === "complete_watch" || inspection.jobType === "case_work";
    if (shouldCreateJob && savedInspectionId) {
      const result = await upsertJob.mutateAsync({
        inspection_id: savedInspectionId,
        due_date: targetDateStr,
        status: "waiting_approval",
        service_type: inspection.jobType || "modern_movement",
        estimate_number: watch.estimateNumber.trim() || null,
      });
      
      if (result.wasUpdated) {
        toast.success("Inspection emailed and job updated in work queue");
      } else {
        toast.success("Inspection emailed and added to work queue");
      }
    } else {
      toast.success("Inspection saved and marked as sent");
    }

    // Update refs so subsequent renders/saves use the new date
    if (targetDateStr) {
      originalTargetDateRef.current = targetDateStr;
      loadedWeeksRef.current = inspection.weeksToTarget;
    }

    return savedInspectionId!;
  }, [customer, watch, inspection, customerId, watchId, draftId, targetDate, session, isEditMode, createCustomer, createWatch, updateWatch, createInspection, updateInspection, upsertJob, trackNoteUsage]);

  // Handle email sent - save then reset form
  const handleEmailSent = React.useCallback(async () => {
    try {
      await saveInspectionForEmail();

      const isMultiItemBatch = inspection.braceletItems && inspection.braceletItems.length > 1;

      if (isMultiItemBatch) {
        // All items saved at once in multi-item mode — full reset
        setCustomer({ name: "", email: "", phone: "" });
        setWatch({ brand: "", model: "", referenceNumber: "", estimateNumber: "" });
        setInspection(emptyExpandedInspectionData());
        setCustomerId(null);
        setWatchId(null);
        setDraftId(null);
        setStep("customer");
      } else {
        // Legacy single-item sequential flow
        const isMultiItem = inspection.totalItems && inspection.totalItems > 1;
        const currentNum = inspection.currentItemNumber || 1;
        const hasMoreItems = isMultiItem && currentNum < inspection.totalItems!;

        if (hasMoreItems) {
          setWatch(prev => ({ ...prev, model: "" }));
          setInspection(prev => ({
            ...emptyExpandedInspectionData(),
            inspectionType: prev.inspectionType,
            jobType: prev.jobType,
            jobTypes: prev.jobTypes,
            weeksToTarget: prev.weeksToTarget,
            totalItems: prev.totalItems,
            currentItemNumber: currentNum + 1,
            braceletRepair: {
              ...emptyExpandedInspectionData().braceletRepair,
              includeBandPolishQuestion: prev.braceletRepair.includeBandPolishQuestion,
            },
          }));
          setWatchId(null);
          setDraftId(null);
          toast.success(`Item ${currentNum} of ${inspection.totalItems} saved. Enter item ${currentNum + 1}.`);
        } else {
          // Full reset
          setCustomer({ name: "", email: "", phone: "" });
          setWatch({ brand: "", model: "", referenceNumber: "", estimateNumber: "" });
          setInspection(emptyExpandedInspectionData());
          setCustomerId(null);
          setWatchId(null);
          setDraftId(null);
          setStep("customer");
        }
      }
    } catch (err: any) {
      console.error("Save on email failed:", err);
      toast.error(err?.message ?? "Failed to save inspection");
    }
  }, [saveInspectionForEmail, inspection.totalItems, inspection.currentItemNumber, inspection.braceletItems]);

  // Save for approval URL - save and return inspection ID, then reset
  const handleSaveForApproval = React.useCallback(async (): Promise<string> => {
    const inspectionId = await saveInspectionForEmail();
    return inspectionId;
  }, [saveInspectionForEmail]);

  // Reset form after approval email sent
  const resetFormAfterEmail = React.useCallback(() => {
    setCustomer({ name: "", email: "", phone: "" });
    setWatch({ brand: "", model: "", referenceNumber: "", estimateNumber: "" });
    setInspection(emptyExpandedInspectionData());
    setCustomerId(null);
    setWatchId(null);
    setDraftId(null);
    
    setStep("customer");
  }, []);

  // Auto-calculate current item number for multi-item estimates
  React.useEffect(() => {
    if (!inspection.totalItems || inspection.totalItems <= 1 || !watch.estimateNumber.trim()) {
      if (inspection.currentItemNumber) {
        setInspection(prev => ({ ...prev, currentItemNumber: undefined }));
      }
      return;
    }

    const calculateItemNumber = async () => {
      try {
        // Count existing watches with this estimate number
        const { count, error } = await supabase
          .from("watches")
          .select("id", { count: "exact", head: true })
          .eq("estimate_number", watch.estimateNumber.trim());

        if (error) throw error;

        // If editing an existing watch, don't increment
        const existingCount = count || 0;
        const nextNumber = isEditMode ? (existingCount || 1) : existingCount + 1;
        const itemNumber = Math.min(nextNumber, inspection.totalItems!);

        setInspection(prev => ({ ...prev, currentItemNumber: itemNumber }));
      } catch (err) {
        console.error("Failed to calculate item number:", err);
        setInspection(prev => ({ ...prev, currentItemNumber: 1 }));
      }
    };

    calculateItemNumber();
  }, [inspection.totalItems, watch.estimateNumber, isEditMode]);

  // Poll for pending scanner uploads + realtime subscription
  React.useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from("scanner_uploads")
        .select("id, filename, storage_path, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (data) setPendingUploads(data);
    };
    fetchPending();

    const channel = supabase
      .channel("scanner-uploads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scanner_uploads" }, () => {
        fetchPending();
        toast.info("New scan received from scanner!");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Process a pending scanner upload through the AI pipeline
  const handleProcessUpload = React.useCallback(async (upload: { id: string; storage_path: string }) => {
    setIsScanning(true);
    setScannerPanelOpen(false);
    toast.info("Processing scanned image...");

    try {
      // Download the image from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("scanner-uploads")
        .download(upload.storage_path);

      if (downloadError || !fileData) throw new Error("Failed to download scan");

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      // Send through the same scantron processing pipeline
      const templateUrl = await getActiveTemplateUrl();
      const { data, error } = await supabase.functions.invoke("scan-scantron", {
        body: { images: [dataUrl], blankTemplateUrl: templateUrl },
      });

      if (error) throw error;
      if (!data?.success || !data?.data) throw new Error(data?.error || "Failed to parse scan");

      // Mark upload as processed
      await supabase.from("scanner_uploads").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", upload.id);
      setPendingUploads(prev => prev.filter(u => u.id !== upload.id));

      // Apply the parsed data (same logic as handleScantronCapture)
      const parsed = data.data;
      const sections = parsed.sections || {};
      const normalizeCondition = (c: string): string => c ? c.toLowerCase().replace(/\s+/g, "_") : "";
      const mapSection = (sectionData: any) => {
        if (!sectionData) return {};
        return {
          condition: normalizeCondition(sectionData.condition),
          selectedNotes: sectionData.selectedNotes || [],
          customNote: sectionData.customNotes?.[0]?.note || "",
          customNotePrice: sectionData.customNotes?.[0]?.price || 0,
          customNoteAddYesNo: sectionData.customNotes?.[0]?.addYesNo || false,
          waiverRequired: sectionData.waiverRequired || false,
          additionalNotes: (sectionData.customNotes || []).slice(1).map((n: any) => ({
            note: n.note || "", price: n.price || 0, addYesNo: n.addYesNo || false,
          })),
        };
      };

      setInspection(prev => ({
        ...prev,
        dialCondition: { ...prev.dialCondition, ...mapSection(sections.dial) },
        handsCondition: { ...prev.handsCondition, ...mapSection(sections.hands) },
        bezelCondition: { ...prev.bezelCondition, ...mapSection(sections.bezel) },
        crownCondition: { ...prev.crownCondition, ...mapSection(sections.crown) },
        caseCondition: { ...prev.caseCondition, ...mapSection(sections.case) },
        crystalCondition: { ...prev.crystalCondition, ...mapSection(sections.crystal) },
        braceletCondition: { ...prev.braceletCondition, ...mapSection(sections.bracelet) },
        caseRestorePrice: sections.case?.caseRestorePrice || prev.caseRestorePrice,
        weldingPrice: parsed.weldingPrice || prev.weldingPrice,
        braceletRepair: parsed.braceletRepair ? {
          ...prev.braceletRepair,
          steelSideHours: parsed.braceletRepair.steelSidePieces?.hours || prev.braceletRepair.steelSideHours,
          steelSideShowYesNo: parsed.braceletRepair.steelSidePieces?.checked || prev.braceletRepair.steelSideShowYesNo,
          steelCenterHours: parsed.braceletRepair.steelCenterPieces?.hours || prev.braceletRepair.steelCenterHours,
          steelCenterShowYesNo: parsed.braceletRepair.steelCenterPieces?.checked || prev.braceletRepair.steelCenterShowYesNo,
          goldCenterPieces: parsed.braceletRepair.goldCenterPieces?.qty || prev.braceletRepair.goldCenterPieces,
          goldCenterPricePerPiece: parsed.braceletRepair.goldCenterPieces?.pricePerPiece || prev.braceletRepair.goldCenterPricePerPiece,
          goldCenterShowYesNo: parsed.braceletRepair.goldCenterPieces?.checked || prev.braceletRepair.goldCenterShowYesNo,
          invertPiecesQty: parsed.braceletRepair.centerPiecesFoilThin?.qty || prev.braceletRepair.invertPiecesQty,
          invertPricePerPiece: parsed.braceletRepair.centerPiecesFoilThin?.pricePerPiece || prev.braceletRepair.invertPricePerPiece,
          invertPiecesShowYesNo: parsed.braceletRepair.centerPiecesFoilThin?.checked || prev.braceletRepair.invertPiecesShowYesNo,
          includeBandPolishQuestion: parsed.braceletRepair.bandPolish?.checked || prev.braceletRepair.includeBandPolishQuestion,
          shorterLinksQty: parsed.braceletRepair.extraLinks?.qty || prev.braceletRepair.shorterLinksQty,
          shorterLinksPrice: parsed.braceletRepair.extraLinks?.pricePerLink || prev.braceletRepair.shorterLinksPrice,
          shorterLinksShowYesNo: parsed.braceletRepair.extraLinks?.checked || prev.braceletRepair.shorterLinksShowYesNo,
        } : prev.braceletRepair,
        miscNotes: parsed.additionalNotes || prev.miscNotes,
      }));

      if (step === "customer") setStep("inspection");
      toast.success(`Scan processed (${parsed.confidence || "unknown"} confidence). Review below.`);
    } catch (err: any) {
      console.error("Scanner upload processing error:", err);
      toast.error(err?.message || "Failed to process scanned image");
    } finally {
      setIsScanning(false);
    }
  }, [step]);

  const handleDismissUpload = React.useCallback(async (id: string) => {
    await supabase.from("scanner_uploads").update({ status: "dismissed" }).eq("id", id);
    setPendingUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const editLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isEditMode || !editId) return;
    if (editLoadedRef.current) return;

    const loadEditData = async () => {
      // Fetch directly from DB — don't rely on cached allInspections (limited to 100)
      const { data: existingInspection, error: fetchErr } = await supabase
        .from("inspections")
        .select("*, watches!inner(*, customers!inner(*))")
        .eq("id", editId)
        .single();

      if (fetchErr || !existingInspection) {
        console.error("[EditLoad] Failed to fetch inspection:", fetchErr);
        return;
      }

      editLoadedRef.current = true;

      // Set customer
      const customerData = existingInspection.watches?.customers;
    if (customerData) {
      setCustomer({
        id: customerData.id,
        name: customerData.name,
        email: customerData.email || "",
      });
      setCustomerId(customerData.id);
    }

    // Set watch
    const watchData = existingInspection.watches;
    if (watchData) {
      // Strip "X of Y" prefix from model for the main watch field
      const rawModel = watchData.model || "";
      const modelWithoutPrefix = rawModel.replace(/^\d+ of \d+\s*/, "");
      setWatch({
        brand: watchData.brand || "",
        model: modelWithoutPrefix,
        referenceNumber: watchData.reference_number || "",
        estimateNumber: watchData.estimate_number || "",
      });
      setWatchId(watchData.id);
      // Preserve the original target date so auto-save doesn't erase it
      originalTargetDateRef.current = watchData.target_date || null;
    }

    // Parse section condition from DB
    const parseCondition = (data: any) => ({
      condition: data?.condition || "",
      selectedNotes: data?.selectedNotes || [],
      customNote: data?.customNote || "",
      customNotePrice: data?.customNotePrice || 0,
      customNoteAddYesNo: data?.customNoteAddYesNo || false,
      additionalNotes: data?.additionalNotes || [],
      price: data?.price || 0,
      waiverRequired: data?.waiverRequired || data?.waiver_required || false,
    });

    // Check if this is part of a multi-item batch (model matches "X of Y" pattern)
    const rawModel = watchData?.model || "";
    const multiItemMatch = rawModel.match(/^(\d+) of (\d+)/);
    const isBraceletBatch = multiItemMatch && existingInspection.inspection_type === "bracelet_only" && watchData?.estimate_number;

    if (isBraceletBatch) {
      // Fetch ALL sibling inspections directly from DB
      const estimateNum = watchData.estimate_number;
      const totalItems = parseInt(multiItemMatch[2], 10);
      const { data: siblingData } = await supabase
        .from("inspections")
        .select("*, watches!inner(*, customers!inner(*))")
        .eq("inspection_type", "bracelet_only")
        .eq("watches.estimate_number", estimateNum)
        .order("created_at", { ascending: true });

      const siblingInspections = (siblingData || [])
        .filter((i: any) => {
          const m = (i.watches?.model || "").match(/^(\d+) of (\d+)/);
          return m && parseInt(m[2], 10) === totalItems;
        })
        .sort((a: any, b: any) => {
          const aNum = parseInt((a.watches.model || "").match(/^(\d+)/)?.[1] || "0", 10);
          const bNum = parseInt((b.watches.model || "").match(/^(\d+)/)?.[1] || "0", 10);
          return aNum - bNum;
        });

      // Build braceletItems array from all siblings
      const braceletItems: import("@/components/inspection/InspectionForm").BraceletItemData[] = siblingInspections.map((sibling: any) => {
        const sibModel = (sibling.watches.model || "").replace(/^\d+ of \d+\s*/, "");
        const sibBracelet = sibling.bracelet_condition as any;
        return {
          model: sibModel,
          braceletCondition: parseCondition(sibBracelet),
          braceletRepair: sibBracelet?.repair_details || {
            hoursMin: "",
            hoursMax: "",
            pins: { quantity: 0, price: 0, addYesNo: false },
            tubes: { quantity: 0, price: 0, addYesNo: false },
            screws: { quantity: 0, price: 0, addYesNo: false },
            notes: "",
          },
          watchHeadRestorePrice: sibBracelet?.watch_head_restore_price || 0,
          gasketsPrice: sibBracelet?.gaskets_price || 0,
          savedWatchId: sibling.watches.id,
          savedInspectionId: sibling.id,
        };
      });

      // Set inspection data using the first sibling for shared fields
      const first = siblingInspections[0] || existingInspection;
      setInspection({
        inspectionType: first.inspection_type || "bracelet_only",
        jobType: first.job_type || "",
        jobTypes: (first as any).job_types || [first.job_type].filter(Boolean),
        dialCondition: parseCondition(first.dial_condition),
        handsCondition: parseCondition(first.hands_condition),
        bezelCondition: parseCondition(first.bezel_condition),
        crownCondition: parseCondition(first.crown_condition),
        caseCondition: parseCondition(first.case_condition),
        crystalCondition: parseCondition(first.crystal_condition),
        braceletCondition: parseCondition(first.bracelet_condition),
        weldingPrice: (first.case_condition as any)?.welding_price || 0,
        caseRestorePrice: (first.case_condition as any)?.restore_price || 0,
        caseRestoreAddYesNo: (first.case_condition as any)?.restore_add_yes_no || false,
        watchHeadRestorePrice: (first.bracelet_condition as any)?.watch_head_restore_price || 0,
        gasketsPrice: (first.bracelet_condition as any)?.gaskets_price || 0,
        braceletRepair: (first.bracelet_condition as any)?.repair_details || {
          hoursMin: "", hoursMax: "",
          pins: { quantity: 0, price: 0, addYesNo: false },
          tubes: { quantity: 0, price: 0, addYesNo: false },
          screws: { quantity: 0, price: 0, addYesNo: false },
          notes: "",
        },
        miscNotes: first.notes || "",
        miscNotesPrice: (first.pricing_details as any)?.miscNotesPrice || undefined,
        miscNotesAddYesNo: (first.pricing_details as any)?.miscNotesAddYesNo || false,
        waiverRequired: first.waiver_required || false,
        waiverSigned: first.waiver_signed || false,
        weeksToTarget: watchData?.target_date
          ? getWeeksToTargetFromDate(watchData.target_date)
          : 0,
        totalEstimate: first.total_estimate || 0,
        braceletItems,
        totalItems: totalItems,
        currentItemNumber: 1,
        departmentTags: ((first as any).department_tag || "").split(",").filter(Boolean) as Array<"W" | "B" | "P" | "PM" | "SJ">,
      });
    } else {
      // Standard single-item edit
      setInspection({
        inspectionType: existingInspection.inspection_type || "complete_watch",
        jobType: existingInspection.job_type || "",
        jobTypes: (existingInspection as any).job_types || [existingInspection.job_type].filter(Boolean),
        dialCondition: parseCondition(existingInspection.dial_condition),
        handsCondition: parseCondition(existingInspection.hands_condition),
        bezelCondition: parseCondition(existingInspection.bezel_condition),
        crownCondition: parseCondition(existingInspection.crown_condition),
        caseCondition: parseCondition(existingInspection.case_condition),
        crystalCondition: parseCondition(existingInspection.crystal_condition),
        braceletCondition: parseCondition(existingInspection.bracelet_condition),
        weldingPrice: (existingInspection.case_condition as any)?.welding_price || 0,
        caseRestorePrice: (existingInspection.case_condition as any)?.restore_price || 0,
        caseRestoreAddYesNo: (existingInspection.case_condition as any)?.restore_add_yes_no || false,
        watchHeadRestorePrice: (existingInspection.bracelet_condition as any)?.watch_head_restore_price || 0,
        gasketsPrice: (existingInspection.bracelet_condition as any)?.gaskets_price || 0,
        braceletRepair: (existingInspection.bracelet_condition as any)?.repair_details || {
          hoursMin: "", hoursMax: "",
          pins: { quantity: 0, price: 0, addYesNo: false },
          tubes: { quantity: 0, price: 0, addYesNo: false },
          screws: { quantity: 0, price: 0, addYesNo: false },
          notes: "",
        },
        miscNotes: existingInspection.notes || "",
        miscNotesPrice: (existingInspection.pricing_details as any)?.miscNotesPrice || undefined,
        miscNotesAddYesNo: (existingInspection.pricing_details as any)?.miscNotesAddYesNo || false,
        waiverRequired: existingInspection.waiver_required || false,
        waiverSigned: existingInspection.waiver_signed || false,
        weeksToTarget: watchData?.target_date
          ? getWeeksToTargetFromDate(watchData.target_date)
          : 0,
        totalEstimate: existingInspection.total_estimate || 0,
        departmentTags: ((existingInspection as any).department_tag || "").split(",").filter(Boolean) as Array<"W" | "B" | "P" | "PM" | "SJ">,
      });
    }

    // Store the loaded weeks value so we can detect user changes
    const loadedWeeks = watchData?.target_date
      ? getWeeksToTargetFromDate(watchData.target_date)
      : 0;
    loadedWeeksRef.current = loadedWeeks;

    // Load HTML email toggle
    setUseHtmlEmail(existingInspection.use_html_email ?? true);

    // Go directly to inspection step if editing
    setStep("inspection");
    };

    loadEditData();
  }, [isEditMode, editId]);

  // Load prefilled customer and watch data from URL params
  React.useEffect(() => {
    if (!isPrefilled || prefillLoaded) return;

    const loadPrefillData = async () => {
      try {
        // Handle Band Only scan - new customer from scan data
        if (prefillType === "bracelet_only" && prefillName) {
          // Set customer from scan params
          setCustomer({
            name: prefillName,
            email: prefillEmail || "",
            phone: prefillPhone || "",
          });
          
          // Set inspection type to bracelet_only and job type to stretch_repair
          // Include band polish question by default for band repairs
          const prefillIsPreciousMetal = (prefillBraceletModel || "").toLowerCase().includes("precious metal");
          setInspection(prev => ({
            ...prev,
            inspectionType: "bracelet_only",
            jobType: "stretch_repair",
            jobTypes: prefillIsPreciousMetal ? ["stretch_repair", "gold_bracelet"] : ["stretch_repair"],
            weeksToTarget: 4, // Default 4 weeks for band repairs
            departmentTags: prefillIsPreciousMetal ? ["PM"] : ["B"],
            braceletRepair: {
              ...prev.braceletRepair,
              includeBandPolishQuestion: true, // Default to included for Band Only
            },
          }));
          
          // Set watch data with estimate number and bracelet model if provided
          setWatch({
            brand: "",
            model: prefillBraceletModel || "",
            referenceNumber: "",
            estimateNumber: prefillEstimateNumber || "",
          });
          
          setPrefillLoaded(true);
          setStep("inspection"); // Go directly to inspection step
          return;
        }
        
        // Load customer data from DB
        if (prefillCustomerId) {
          const { data: customerData } = await supabase
            .from("customers")
            .select("*")
            .eq("id", prefillCustomerId)
            .single();
          
          if (customerData) {
            setCustomer({
              id: customerData.id,
              name: customerData.name,
              email: customerData.email || "",
              phone: customerData.phone || "",
            });
            setCustomerId(customerData.id);
          }
        }

        // Load watch data from DB if watchId provided
        if (prefillWatchId) {
          const { data: watchData } = await supabase
            .from("watches")
            .select("*")
            .eq("id", prefillWatchId)
            .single();
          
          if (watchData) {
            setWatch({
              brand: watchData.brand || "",
              model: watchData.model || "",
              referenceNumber: watchData.reference_number || "",
              estimateNumber: watchData.estimate_number || "",
            });
            setWatchId(watchData.id);
            // Preserve the original target date so re-saves don't shift it
            if (watchData.target_date) {
              originalTargetDateRef.current = watchData.target_date;
            }
            
            // Auto-select "complete_watch" when loaded watch has a reference number
            if (watchData.reference_number) {
              setInspection(prev => ({
                ...prev,
                inspectionType: "complete_watch",
              }));
            }
          }
        } else if (prefillBrand || prefillEstimateNumber) {
          // No watchId but we have scan data - prefill watch form from URL params
          setWatch({
            brand: prefillBrand || "",
            model: prefillModel || "",
            referenceNumber: prefillReferenceNumber || "",
            estimateNumber: prefillEstimateNumber || "",
          });
        }

        // Auto-select "complete_watch" when a reference number is present
        if (prefillReferenceNumber) {
          setInspection(prev => ({
            ...prev,
            inspectionType: "complete_watch",
          }));
        }

        // Apply service type from QR scan to job type and weeks
        if (prefillServiceType || prefillServiceCodes) {
          const { mapServiceTypeToJobType } = await import("@/components/clients/QrScanResultDialog");
          const mapped = mapServiceTypeToJobType(prefillServiceType || '', prefillServiceCodes || '');
          if (mapped) {
            setInspection(prev => ({
              ...prev,
              jobType: mapped.jobType,
              jobTypes: mapped.allJobTypes,
              weeksToTarget: mapped.weeks,
            }));
          }
        }

        setPrefillLoaded(true);
      } catch (err) {
        console.error("Failed to load prefill data:", err);
      }
    };

    loadPrefillData();
  }, [isPrefilled, prefillCustomerId, prefillWatchId, prefillBrand, prefillModel, prefillReferenceNumber, prefillEstimateNumber, prefillLoaded, prefillType, prefillName, prefillEmail, prefillPhone, prefillServiceType]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const isMultiItemMode = inspection.braceletItems && inspection.braceletItems.length > 1;

      // Check for existing watch by estimate number or reference number (only for new single-item inspections)
      if (!isMultiItemMode && !isEditMode && !watchId && watch.estimateNumber.trim()) {
        const existing = await findWatchByEstimateOrReference(
          watch.estimateNumber.trim(),
          watch.referenceNumber.trim(),
          watch.model.trim()
        );
        
        if (existing) {
          if (existing.hasJob && existing.jobId) {
            toast.info("A job already exists for this estimate number. Opening for editing.");
            navigate(`/new-job?edit=${existing.jobId}`);
            return;
          } else {
            toast.info("A watch with this estimate number already exists. Using existing record.");
            setWatchId(existing.watchId);
            setCustomerId(customer.id || null);
          }
        }
      }

      // 1. Create or use existing customer
      let savedCustomerId = customerId || customer.id;
      if (!savedCustomerId) {
        const newCustomer = await createCustomer.mutateAsync({
          name: customer.name.trim(),
          email: customer.email.trim() || null,
          created_by: session?.user?.id || null,
        });
        savedCustomerId = newCustomer.id;
      }

      // 2. Get target date
      const targetDateStr = targetDate ? formatDateLocal(targetDate) : null;

      // ─── MULTI-ITEM SAVE ───
      if (isMultiItemMode) {
        const totalItems = inspection.braceletItems!.length;
        const updatedItems = [...inspection.braceletItems!];

        for (let idx = 0; idx < totalItems; idx++) {
          const item = updatedItems[idx];
          const itemPrefix = `${idx + 1} of ${totalItems}`;
          const modelStr = itemPrefix + (item.model.trim() ? ` ${item.model.trim()}` : "");

          let itemWatchId = item.savedWatchId || null;

          if (itemWatchId) {
            // Update existing watch
            await updateWatch.mutateAsync({
              id: itemWatchId,
              brand: watch.brand.trim(),
              model: modelStr,
              target_date: targetDateStr,
            });
          } else {
            // Check for existing watch with this estimate + model combo
            const existingCheck = await findWatchByEstimateOrReference(
              watch.estimateNumber.trim(),
              "",
              modelStr
            );

            if (existingCheck) {
              itemWatchId = existingCheck.watchId;
              await updateWatch.mutateAsync({
                id: itemWatchId,
                brand: watch.brand.trim(),
                model: modelStr,
                target_date: targetDateStr,
              });
            } else {
              const newWatch = await createWatch.mutateAsync({
                customer_id: savedCustomerId,
                brand: watch.brand.trim(),
                model: modelStr,
                reference_number: null,
                estimate_number: watch.estimateNumber.trim(),
                target_date: targetDateStr,
              });
              itemWatchId = newWatch.id;
            }
          }

          // Create or update inspection for this item
          if (item.savedInspectionId) {
            await updateInspection.mutateAsync({
              id: item.savedInspectionId,
              watch_id: itemWatchId,
              ...buildInspectionData("approved", item),
            });
          } else {
            const newInsp = await createInspection.mutateAsync({
              watch_id: itemWatchId,
              ...buildInspectionData("approved", item),
            });
            updatedItems[idx] = { ...item, savedWatchId: itemWatchId, savedInspectionId: newInsp.id };
          }
        }

        // Store IDs back so next save updates instead of duplicating
        setInspection(prev => ({ ...prev, braceletItems: updatedItems }));
        toast.success(`${totalItems} bracelet inspections saved`);
        setIsSubmitting(false);
        return;
      }

      // ─── SINGLE ITEM SAVE ───
      // 3. Create or use existing watch
      let savedWatchId = watchId;
      if (!savedWatchId) {
        const existingCheck = await findWatchByEstimateOrReference(
          watch.estimateNumber.trim(),
          watch.referenceNumber.trim(),
          watch.model.trim()
        );
        
        if (existingCheck) {
          savedWatchId = existingCheck.watchId;
          await updateWatch.mutateAsync({
            id: savedWatchId,
            brand: watch.brand.trim(),
             model: getModelWithItemPrefix() || null,
            reference_number: watch.referenceNumber.trim() || null,
            target_date: targetDateStr,
          });
        } else {
          const newWatch = await createWatch.mutateAsync({
            customer_id: savedCustomerId,
            brand: watch.brand.trim(),
             model: getModelWithItemPrefix() || null,
            reference_number: watch.referenceNumber.trim() || null,
            estimate_number: watch.estimateNumber.trim(),
            target_date: targetDateStr,
          });
          savedWatchId = newWatch.id;
        }
      } else {
        await updateWatch.mutateAsync({
          id: savedWatchId,
          brand: watch.brand.trim(),
          model: getModelWithItemPrefix() || null,
          reference_number: watch.referenceNumber.trim() || null,
          estimate_number: watch.estimateNumber.trim(),
          target_date: targetDateStr,
        });
      }

      // Save reference → brand/model to library (fire-and-forget)
      saveToReferenceLibrary();

      // 4. Create or update inspection with all expanded data
      let savedInspection;
      if (draftId) {
        savedInspection = await updateInspection.mutateAsync({
          id: draftId,
          watch_id: savedWatchId,
          ...buildInspectionData("approved"),
        });
      } else {
        savedInspection = await createInspection.mutateAsync({
          watch_id: savedWatchId,
          ...buildInspectionData("approved"),
        });
      }

      // 5. Upsert job (for complete watch or case work, not bracelet only)
      let jobId: string | null = null;
      const shouldCreateJob = inspection.inspectionType === "complete_watch" || inspection.jobType === "case_work";
      if (shouldCreateJob) {
        const result = await upsertJob.mutateAsync({
          inspection_id: savedInspection.id,
          due_date: targetDateStr,
          status: "waiting_approval",
          service_type: inspection.jobType || inspection.inspectionType,
          estimate_number: watch.estimateNumber.trim() || null,
        });
        
        // Get the job ID - either from the update result or refetch
        if (result.id) {
          jobId = result.id;
        } else {
          // For new jobs, fetch the created job
          const { data: createdJob } = await supabase
            .from("jobs")
            .select("id")
            .eq("inspection_id", savedInspection.id)
            .maybeSingle();
          jobId = createdJob?.id || null;
        }
        
        if (result.wasUpdated) {
          toast.success("Inspection saved and job updated in work queue");
        } else {
          toast.success("Inspection saved and added to work queue");
        }
      } else {
        toast.success("Bracelet inspection saved");
      }

      // 6. Auto-create draft waiver if waiver is required
      if (inspection.waiverRequired && jobId) {
        // Check if a draft waiver already exists for this job
        const { data: existingWaiver } = await supabase
          .from("liability_waivers")
          .select("id")
          .eq("job_id", jobId)
          .in("status", ["draft", "pending"])
          .maybeSingle();

        if (!existingWaiver) {
          // Build additional info from dial/hands notes
          const dialNotes = [
            ...inspection.dialCondition.selectedNotes,
            inspection.dialCondition.customNote
          ].filter(Boolean);
          const handsNotes = [
            ...inspection.handsCondition.selectedNotes,
            inspection.handsCondition.customNote
          ].filter(Boolean);
          
          const additionalInfo = [
            dialNotes.length > 0 ? `Dial: ${dialNotes.join(", ")}` : null,
            handsNotes.length > 0 ? `Hands: ${handsNotes.join(", ")}` : null,
          ].filter(Boolean).join("\n");

          // Create draft waiver with pre-populated details
          await supabase
            .from("liability_waivers")
            .insert({
              job_id: jobId,
              status: "draft",
              customer_name: customer.name,
              customer_email: customer.email || null,
              watch_brand: watch.brand,
              watch_model: watch.model || null,
              serial_number: watch.referenceNumber || null,
              reference_number: watch.referenceNumber || null,
              dial_defects: inspection.dialCondition.waiverRequired || false,
              hand_defects: inspection.handsCondition.waiverRequired || false,
              additional_info: additionalInfo || null,
            });
        }
      }

      // Update refs so subsequent renders/saves use the new date
      if (targetDateStr) {
        originalTargetDateRef.current = targetDateStr;
        loadedWeeksRef.current = inspection.weeksToTarget;
      }

      toast.success("Inspection saved successfully");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle scantron photos from camera (barcode already scanned via hardware scanner)
  const handleScantronCapture = async (photos: string[]) => {
    setCameraOpen(false);
    setIsScanning(true);
    toast.info("Processing scantron sheet...");

    try {
      // Try to decode any DataMatrix/PDF417/QR barcode from the image client-side
      let decodedBarcode: string | undefined;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        
        // Try with all supported formats first, then PDF417-only for better detection
        const formatSets = [
          [
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          [Html5QrcodeSupportedFormats.PDF_417],
        ];

        for (const formats of formatSets) {
          if (decodedBarcode) break;
          const scanner = new Html5Qrcode("scantron-barcode-decoder", {
            formatsToSupport: formats,
            verbose: false,
          });
          for (const photo of photos) {
            try {
              const res = await fetch(photo);
              const blob = await res.blob();
              const file = new File([blob], "scan.jpg", { type: blob.type });
              const result = await scanner.scanFile(file, /* showImage= */ true);
              if (result) {
                decodedBarcode = result;
                console.log("[Scantron] Barcode decoded client-side:", result.substring(0, 100));
                break;
              }
            } catch (scanErr) {
              console.debug("[Scantron] No barcode found with formats", formats.map(f => f.toString()), scanErr);
            }
          }
          try { scanner.clear(); } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn("[Scantron] Client-side barcode decode skipped:", e);
      }
      
      console.log("[Scantron] decodedBarcode:", decodedBarcode ? decodedBarcode.substring(0, 100) : "none");

      // Fetch the active blank template URL for A/B comparison
      const templateUrl = await getActiveTemplateUrl();

      // Send photos + template + decoded barcode to AI for inspection note extraction
      const { data, error } = await supabase.functions.invoke('scan-scantron', {
        body: { images: photos, blankTemplateUrl: templateUrl, decodedBarcode },
      });

      if (error) throw error;
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || 'Failed to parse scantron');
      }

      const parsed = data.data;
      const sections = parsed.sections || {};

      // Helper to map AI section data to SectionConditionData
      const normalizeCondition = (c: string): string => {
        if (!c) return "";
        return c.toLowerCase().replace(/\s+/g, "_");
      };
      const mapSection = (sectionData: any): Partial<import("@/components/inspection/InspectionSection").SectionConditionData> => {
        if (!sectionData) return {};
        return {
          condition: normalizeCondition(sectionData.condition),
          selectedNotes: sectionData.selectedNotes || [],
          customNote: sectionData.customNotes?.[0]?.note || "",
          customNotePrice: sectionData.customNotes?.[0]?.price || 0,
          customNoteAddYesNo: sectionData.customNotes?.[0]?.addYesNo || false,
          waiverRequired: sectionData.waiverRequired || false,
          additionalNotes: (sectionData.customNotes || []).slice(1).map((n: any) => ({
            note: n.note || "",
            price: n.price || 0,
            addYesNo: n.addYesNo || false,
          })),
        };
      };

      // Merge into current inspection state
      setInspection(prev => ({
        ...prev,
        dialCondition: { ...prev.dialCondition, ...mapSection(sections.dial) },
        handsCondition: { ...prev.handsCondition, ...mapSection(sections.hands) },
        bezelCondition: { ...prev.bezelCondition, ...mapSection(sections.bezel) },
        crownCondition: { ...prev.crownCondition, ...mapSection(sections.crown) },
        caseCondition: { ...prev.caseCondition, ...mapSection(sections.case) },
        crystalCondition: { ...prev.crystalCondition, ...mapSection(sections.crystal) },
        braceletCondition: { ...prev.braceletCondition, ...mapSection(sections.bracelet) },
        retailPolish: sections.case?.retailPolish || prev.retailPolish,
        caseRestorePrice: sections.case?.caseRestorePrice || prev.caseRestorePrice,
        weldingPrice: parsed.weldingPrice || prev.weldingPrice,
        braceletRepair: parsed.braceletRepair ? {
          ...prev.braceletRepair,
          steelSideHours: parsed.braceletRepair.steelSidePieces?.hours || prev.braceletRepair.steelSideHours,
          steelSideShowYesNo: parsed.braceletRepair.steelSidePieces?.checked || prev.braceletRepair.steelSideShowYesNo,
          steelCenterHours: parsed.braceletRepair.steelCenterPieces?.hours || prev.braceletRepair.steelCenterHours,
          steelCenterShowYesNo: parsed.braceletRepair.steelCenterPieces?.checked || prev.braceletRepair.steelCenterShowYesNo,
          goldCenterPieces: parsed.braceletRepair.goldCenterPieces?.qty || prev.braceletRepair.goldCenterPieces,
          goldCenterPricePerPiece: parsed.braceletRepair.goldCenterPieces?.pricePerPiece || prev.braceletRepair.goldCenterPricePerPiece,
          goldCenterShowYesNo: parsed.braceletRepair.goldCenterPieces?.checked || prev.braceletRepair.goldCenterShowYesNo,
          invertPiecesQty: parsed.braceletRepair.centerPiecesFoilThin?.qty || prev.braceletRepair.invertPiecesQty,
          invertPricePerPiece: parsed.braceletRepair.centerPiecesFoilThin?.pricePerPiece || prev.braceletRepair.invertPricePerPiece,
          invertPiecesShowYesNo: parsed.braceletRepair.centerPiecesFoilThin?.checked || prev.braceletRepair.invertPiecesShowYesNo,
          includeBandPolishQuestion: parsed.braceletRepair.bandPolish?.checked || prev.braceletRepair.includeBandPolishQuestion,
          shorterLinksQty: parsed.braceletRepair.extraLinks?.qty || prev.braceletRepair.shorterLinksQty,
          shorterLinksPrice: parsed.braceletRepair.extraLinks?.pricePerLink || prev.braceletRepair.shorterLinksPrice,
          shorterLinksShowYesNo: parsed.braceletRepair.extraLinks?.checked || prev.braceletRepair.shorterLinksShowYesNo,
        } : prev.braceletRepair,
        miscNotes: parsed.additionalNotes || prev.miscNotes,
      }));

      // Process barcode data if found by the AI — show confirmation first
      if (parsed.barcodeData?.found) {
        const bc = parsed.barcodeData;
        const rawBarcode = [
          bc.name ? `N:${bc.name}` : "",
          bc.email ? `E:${bc.email}` : "",
          bc.phone ? `P:${bc.phone}` : "",
          bc.referenceNumber ? `R:${bc.referenceNumber}` : "",
          bc.estimateNumber ? `#:${bc.estimateNumber}` : "",
          bc.serviceCodes ? `SC:${bc.serviceCodes}` : "",
          bc.serviceType ? `ST:${bc.serviceType}` : "",
        ].filter(Boolean).join("|");

        if (rawBarcode && bc.estimateNumber) {
          // Look up customer to show in confirmation
          let matchedCustomerName: string | undefined;
          try {
            const customerMatch = await findCustomerByEstimate(bc.estimateNumber);
            if (customerMatch) {
              const { data: watchData } = await supabase
                .from("watches")
                .select("customers(name)")
                .eq("id", customerMatch.watchId)
                .single();
              matchedCustomerName = (watchData?.customers as any)?.name;
            }
          } catch { /* ignore lookup errors */ }

          setPendingBarcodeConfirm({
            estimateNumber: bc.estimateNumber,
            name: bc.name || "",
            email: bc.email || "",
            phone: bc.phone || "",
            referenceNumber: bc.referenceNumber || "",
            rawBarcode,
            matchedCustomerName,
          });
        } else if (rawBarcode) {
          // No estimate number — auto-process without confirmation
          try {
            await handleBarcodeScan(rawBarcode);
          } catch (bcErr) {
            console.warn("Barcode processing failed, continuing:", bcErr);
          }
        }
      }

      // Always advance to inspection step
      if (step === "customer") {
        setStep("inspection");
      }

      const confidence = parsed.confidence || "unknown";
      toast.success(`Scantron parsed (${confidence} confidence). Review below.`);

    } catch (err: any) {
      console.error('Scantron scan error:', err);
      toast.error(err?.message || "Failed to process scantron photo");
    } finally {
      setIsScanning(false);
    }
  };

  // Handle processing a queued page from batch PDF
  const handleProcessQueuedPage = async (page: QueuedPage) => {
    await handleScantronCapture([page.dataUrl]);
  };

  // Save current inspection and advance to next queue item
  const handleSaveAndNext = async () => {
    setIsSubmitting(true);
    try {
      await saveInspectionForEmail();
      markCurrentDone();
      
      // Reset form for next item
      setCustomer({ name: "", email: "", phone: "" });
      setWatch({ brand: "", model: "", referenceNumber: "", estimateNumber: "" });
      setInspection(emptyExpandedInspectionData());
      setCustomerId(null);
      setWatchId(null);
      setDraftId(null);
      setStep("customer");

      const hasMore = advanceToNext();
      if (hasMore) {
        toast.success(`Saved! Moving to page ${queueCurrentIndex + 2} of ${queueTotalCount}.`);
        // Auto-open scanner panel to process next item
        setScannerPanelOpen(true);
      } else {
        toast.success("Batch queue completed! All pages processed.");
      }
    } catch (err: any) {
      console.error("Save & Next failed:", err);
      toast.error(err?.message ?? "Failed to save inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip current queue item and move to next
  const handleSkipQueueItem = () => {
    markCurrentSkipped();
    const hasMore = advanceToNext();
    if (hasMore) {
      toast.info(`Skipped. Moving to page ${queueCurrentIndex + 2} of ${queueTotalCount}.`);
      setScannerPanelOpen(true);
    } else {
      toast.info("Batch queue completed.");
    }
  };

  // Handle PDF417 barcode scanned via hardware scanner into customer search
  const handleBarcodeScan = React.useCallback(async (rawData: string) => {
    const parsed = parsePdf417(rawData);
    if (!parsed.name && !parsed.estimateNumber && !parsed.referenceNumber) {
      toast.error("Could not read barcode data. Please try again.");
      return;
    }

    toast.info("Processing barcode...");

    let resultCustomer = { name: parsed.name, email: parsed.email, phone: parsed.phone, id: undefined as string | undefined };
    let resultWatch = { brand: parsed.brand || "", model: parsed.model || "", referenceNumber: parsed.referenceNumber, estimateNumber: parsed.estimateNumber };
    let foundCustomerId: string | undefined;
    let foundWatchId: string | undefined;

    // Try to find existing customer by estimate number
    if (parsed.estimateNumber) {
      // Use findCustomerByEstimate to get customer info (works across multi-item estimates)
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
          // Keep the scanned model/description — don't overwrite with existing watch's model
          resultWatch = {
            brand: watchData.brand || parsed.brand || "",
            model: parsed.model || "",  // Use scanned model, not existing watch's model
            referenceNumber: parsed.referenceNumber || watchData.reference_number || "",
            estimateNumber: parsed.estimateNumber || "",
          };
          foundCustomerId = watchData.customers.id;
          // Don't set foundWatchId — let the save logic decide based on model match
          toast.success(`Found existing client: ${watchData.customers.name}`);
        }
      }
    }

    // Detect brand/model from reference if not found
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

    // Fill customer data
    setCustomer({
      id: resultCustomer.id,
      name: resultCustomer.name,
      email: resultCustomer.email,
      phone: resultCustomer.phone,
    });
    if (foundCustomerId) setCustomerId(foundCustomerId);
    if (foundWatchId) setWatchId(foundWatchId);

    // Fill watch data
    setWatch(resultWatch);

    // Auto-save reference → brand/model to library at scan time (fire-and-forget)
    if (resultWatch.referenceNumber?.trim() && resultWatch.brand?.trim()) {
      const ref = resultWatch.referenceNumber.split("-")[0].trim().toUpperCase();
      if (ref) {
        supabase
          .from("model_references")
          .upsert(
            {
              part_number: ref,
              brand: resultWatch.brand.trim(),
              model: resultWatch.model?.trim() || null,
              source: "portal",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "part_number" }
          )
          .then(() => {});
      }
    }

    // Detect band-only: no reference number AND (no service codes OR all codes are bracelet-related)
    // Also detect when reference field starts with "Bracelet Repair" (RS label format for band-only jobs)
    const braceletCodes = new Set(["B", "BR", "GB", "SR"]);
    const codes = parsed.serviceCodes ? parsed.serviceCodes.split(",").map(c => c.trim()).filter(Boolean) : [];
    const allCodesBracelet = codes.length === 0 || codes.every(c => braceletCodes.has(c.toUpperCase()));
    const refIsBraceletRepair = (parsed.referenceNumber || "").toLowerCase().startsWith("bracelet repair");
    const isBandOnly = refIsBraceletRepair || (allCodesBracelet && (!parsed.referenceNumber || parsed.serviceType === "B"));

    if (isBandOnly) {
      // Use BM field first, then M field as fallback for bracelet model
      const braceletModel = parsed.braceletModel || parsed.model || "";
      setWatch(prev => ({ ...prev, brand: prev.brand || "", model: braceletModel || prev.model }));
      // Detect precious metal from bracelet model, service codes, OR reference field text
      const refLower = (parsed.referenceNumber || "").toLowerCase();
      const scanIsPreciousMetal = braceletModel.toLowerCase().includes("precious metal") || codes.some(c => c.toUpperCase() === "GB") || refLower.includes(" pm") || refLower.includes("gold");
      const deptTags: Array<"W" | "B" | "P" | "PM" | "SJ"> = scanIsPreciousMetal ? ["PM"] : ["B"];
      setInspection(prev => ({
        ...prev,
        inspectionType: "bracelet_only",
        jobType: "stretch_repair",
        jobTypes: scanIsPreciousMetal ? ["stretch_repair", "gold_bracelet"] : ["stretch_repair"],
        weeksToTarget: 4,
        departmentTags: deptTags,
        braceletRepair: {
          ...prev.braceletRepair,
          includeBandPolishQuestion: true,
        },
      }));
    } else if (parsed.serviceType || parsed.serviceCodes) {
      // Apply service type for complete watch
      const { mapServiceTypeToJobType } = await import("@/components/clients/QrScanResultDialog");
      const mapped = mapServiceTypeToJobType(parsed.serviceType || "", parsed.serviceCodes || "");
      if (mapped) {
        // Determine department tag from service codes
        const upperCodes = codes.map(c => c.toUpperCase());
        const polishCodes = new Set(["P", "CW"]);
        const deptTags: Array<"W" | "B" | "P" | "PM" | "SJ"> = [];
        // Build multi-select tags from service codes
        if (upperCodes.some(c => !braceletCodes.has(c) && !polishCodes.has(c) && c !== "GB")) deptTags.push("W");
        if (upperCodes.some(c => braceletCodes.has(c))) deptTags.push("B");
        if (upperCodes.some(c => polishCodes.has(c))) deptTags.push("P");
        if (upperCodes.some(c => c === "GB")) deptTags.push("PM");
        // Auto-tag SJ if job types include small_job
        if (mapped.allJobTypes.includes("small_job")) deptTags.push("SJ");
        if (deptTags.length === 0) deptTags.push("W");

        setInspection(prev => ({
          ...prev,
          inspectionType: "complete_watch",
          jobType: mapped.jobType,
          jobTypes: mapped.allJobTypes,
          weeksToTarget: mapped.weeks,
          departmentTags: deptTags,
        }));
      }
    } else if (parsed.referenceNumber) {
      // Has reference number but no service codes — leave job type blank for manual selection
      setInspection(prev => ({
        ...prev,
        inspectionType: "complete_watch",
        departmentTags: ["W"],
      }));
    }

    // Move to inspection step
    setStep("inspection");
    toast.success(isBandOnly ? "Band-only barcode scanned — review data below" : "Barcode scanned — verify Job Type and review data below", { duration: 5000 });
  }, []);

  // Listen for hardware barcode scanner input on the page (both steps)
  useBarcodeScannerInput({
    onScan: handleBarcodeScan,
    enabled: !cameraOpen && !isScanning,
    minLength: 5,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {isEditMode ? "Edit inspection" : "New inspection"}
          </h1>
          {queueIsActive && queueTotalCount > 0 && (
            <button
              onClick={() => setScannerPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Layers className="h-3.5 w-3.5" />
              Queue: {queueCurrentIndex + 1} / {queueTotalCount}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            title="Scanner Auto-Upload"
            onClick={() => setScannerPanelOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
            {pendingUploads.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {pendingUploads.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Scan barcode label with camera (fallback)"
            onClick={() => setBarcodeScannerOpen(true)}
          >
            <ScanBarcode className="h-4 w-4 mr-1.5" />
            Scan Label
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Manage Scantron Templates"
            onClick={() => setTemplateManagerOpen(true)}
          >
            <FileCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isScanning}
            onClick={() => setCameraOpen(true)}
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-1.5" />
            )}
            {isScanning ? "Scanning..." : "Camera"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    handleScantronCapture([reader.result as string]);
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
            }}
          >
            <ScanLine className="h-4 w-4 mr-1.5" />
            Scan Sheet
          </Button>
        </div>
      </header>

      {/* Step Indicator */}
      <nav className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.key}>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors",
                idx < currentStepIndex && "bg-primary/10 text-primary",
                idx === currentStepIndex && "bg-primary text-primary-foreground",
                idx > currentStepIndex && "bg-muted text-muted-foreground"
              )}
            >
              {idx < currentStepIndex ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background text-xs">
                  {idx + 1}
                </span>
              )}
              {s.label}
            </div>
            {idx < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" />
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Client Approval Panel — show when editing an inspection that has an approval */}
      {isEditMode && draftId && (
        <ClientApprovalPanel inspectionId={draftId} />
      )}

      {/* Step Content */}
      <section className="rounded-lg border border-border bg-card p-4">
        {step === "customer" && (
          <>
            {/* Drag & Drop zone for scanned inspection sheet */}
            <div
              className={cn(
                "mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
                scantronDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setScantronDragOver(true); }}
              onDragLeave={() => setScantronDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setScantronDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  const reader = new FileReader();
                  reader.onload = () => handleScantronCapture([reader.result as string]);
                  reader.readAsDataURL(file);
                } else {
                  toast.error("Please drop an image file (JPEG, PNG)");
                }
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (ev) => {
                  const f = (ev.target as HTMLInputElement).files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = () => handleScantronCapture([reader.result as string]);
                    reader.readAsDataURL(f);
                  }
                };
                input.click();
              }}
            >
              {isScanning ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              ) : (
                <ScanLine className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <p className="text-sm font-medium text-muted-foreground">
                {isScanning ? "Processing sheet…" : "Drag & drop scanned inspection sheet here"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">or click to browse</p>
            </div>
            <CustomerForm
            value={customer}
            onChange={setCustomer}
            watchValue={watch}
            onWatchChange={setWatch}
            onWatchIdChange={setWatchId}
            selectedWatchId={watchId}
            onBarcodeScan={handleBarcodeScan}
            onNext={(options) => {
              if (options?.isBraceletOnly) {
                setInspection(prev => ({ 
                  ...prev, 
                  inspectionType: "bracelet_only",
                  jobType: "stretch_repair",
                  weeksToTarget: 4,
                  braceletRepair: {
                    ...prev.braceletRepair,
                    includeBandPolishQuestion: true,
                  }
                }));
              }
              setStep("inspection");
            }}
          />
          </>
        )}
        {step === "inspection" && (
          <InspectionForm
            value={inspection}
            onChange={setInspection}
            onSubmit={handleSubmit}
            onBack={() => setStep("customer")}
            onClear={handleClearInspection}
            onEmailSent={handleEmailSent}
            onSaveForApproval={handleSaveForApproval}
            onResetAfterApproval={resetFormAfterEmail}
            isSubmitting={isSubmitting}
            customerName={customer.name}
            customerEmail={customer.email}
            watchData={watch}
            onWatchChange={setWatch}
            useHtmlEmail={useHtmlEmail}
            onUseHtmlEmailChange={setUseHtmlEmail}
            inspectionId={draftId}
            originalTargetDate={originalTargetDateRef.current}
            loadedWeeksToTarget={loadedWeeksRef.current}
          />
        )}
      </section>

      {/* Batch Queue Actions - shown when processing a multi-page PDF */}
      {queueIsActive && queueTotalCount > 0 && step === "inspection" && (
        <section className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-medium">
              Page {queueCurrentIndex + 1} of {queueTotalCount}
            </span>
            <span className="text-muted-foreground">
              ({queueDoneCount} done)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipQueueItem}
            >
              Skip
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAndNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Save & Next
            </Button>
          </div>
        </section>
      )}

      <BarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={(code) => {
          setBarcodeScannerOpen(false);
          handleBarcodeScan(code);
        }}
      />
      <ScantronCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleScantronCapture}
        isProcessing={isScanning}
      />
      <ScantronTemplateManager
        open={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
      />
      <ScannerControlPanel
        open={scannerPanelOpen}
        onClose={() => setScannerPanelOpen(false)}
        pendingUploads={pendingUploads}
        onProcessUpload={handleProcessUpload}
        onDismissUpload={handleDismissUpload}
        onProcessLocalFile={(file) => {
          setScannerPanelOpen(false);
          handleScantronCapture([file.dataUrl]);
        }}
        onProcessQueuedPage={(page) => {
          setScannerPanelOpen(false);
          handleProcessQueuedPage(page);
        }}
      />
      {/* Hidden element for Html5Qrcode barcode decoder */}
      <div id="scantron-barcode-decoder" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} />
      <BarcodeConfirmDialog
        open={!!pendingBarcodeConfirm}
        data={pendingBarcodeConfirm}
        onConfirm={async (correctedRawBarcode) => {
          setPendingBarcodeConfirm(null);
          try {
            await handleBarcodeScan(correctedRawBarcode);
            toast.success("Barcode label confirmed and processed.");
          } catch (err) {
            console.warn("Barcode processing failed:", err);
            toast.error("Failed to process barcode data");
          }
        }}
        onSkip={() => {
          setPendingBarcodeConfirm(null);
          toast.info("Barcode skipped — enter customer data manually.");
        }}
      />
    </main>
  );
};

export default NewInspection;
