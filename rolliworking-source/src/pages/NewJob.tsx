import * as React from "react"; 
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, format, parse } from "date-fns";
import { ArrowLeft, CalendarIcon, ExternalLink, Printer, Save, Trash2, X } from "lucide-react";

import { JobStatusStepper } from "@/components/jobs/JobStatusStepper";
import { PartsRequestSection, type PartRequest } from "@/components/jobs/PartsRequestSection";
import { UsedPartsSection } from "@/components/jobs/UsedPartsSection";
import { type JobStatus, JOB_STATUS_ORDER, JOB_STATUS_LABELS } from "@/lib/job-utils";
import { updatePartsWithStatus } from "@/lib/parts-request-helpers";
import { toast } from "sonner";
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

import { supabase } from "@/integrations/supabase/client";
import { ReadOnlyInspectionNotes } from "@/components/inspection/ReadOnlyInspectionNotes";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs, useDeleteJob, type Job } from "@/hooks/use-jobs";
import { useHasPermission } from "@/hooks/use-permissions";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
// Native checkbox used instead of Radix to avoid infinite loop bug
import { ClientSelector, type SelectedClient } from "@/components/clients/ClientSelector";
import { ROLEX_MODELS, TUDOR_MODELS, getModelsByBrand, detectWatchFromReference } from "@/lib/watch-constants";

// Service types with durations
const SERVICE_TYPES = [
  { value: "modern_movement_service", label: "Modern Movement Service", weeks: 4, isMovement: true },
  { value: "vintage_movement_service", label: "Vintage Movement Service", weeks: 12, isMovement: true },
  { value: "antique_movement_service", label: "Antique Movement Service", weeks: 26, isMovement: true },
  { value: "bracelet_repair", label: "Bracelet Repair", weeks: 4, isMovement: false },
  { value: "gold_bracelet_repair", label: "Gold Bracelet Repair", weeks: 6, isMovement: false },
  { value: "case_restoration", label: "Case Restoration", weeks: 3, isMovement: false },
  { value: "warranty", label: "Warranty", weeks: 4, isMovement: false },
  { value: "small_job", label: "Small Job", days: 14, isMovement: false },
];

interface OutsourcedTask {
  id: string;
  description: string;
  vendor: string;
  status: "pending" | "sent" | "finished";
}

// Delete Job Section Component
const DeleteJobSection = ({ jobId }: { jobId: string }) => {
  const navigate = useNavigate();
  const deleteJob = useDeleteJob();

  const { data: canDeletePermission, isLoading: isDeletePermLoading } =
    useHasPermission("jobs.delete");

  // Never expose destructive actions while permissions are still loading
  const canDelete = isDeletePermLoading ? false : canDeletePermission === true;

  if (!canDelete) return null;

  const handleDelete = async () => {
    try {
      await deleteJob.mutateAsync(jobId);
      toast.success("Job deleted successfully");
      navigate("/work-queue");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete job");
    }
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-destructive">Delete Job</h3>
            <p className="text-sm text-muted-foreground">
              Permanently remove this job from the system. This action cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteJob.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteJob.isPending ? "Deleting..." : "Delete Job"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this job and all associated data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

interface FormData {
  watch_brand: string;
  watch_model: string;
  reference_number: string;
  estimate_number: string;
  intake_date: string;
  due_date: string;
  notes: string;
  needs_liability_waiver: boolean;
  waiver_reason: string;
  waiver_signed: boolean;
}

const NewJob = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;

  const { data: allJobs } = useJobs();

  usePageMeta({
    title: isEditMode ? "Edit Job • WatchFlow" : "New Job • WatchFlow",
    description: isEditMode ? "Edit job details" : "Create a new watch repair job",
    canonicalPath: isEditMode ? `/new-job?edit=${editId}` : "/new-job",
  });

  const { data: canEditPermission, isLoading: isPermLoading } = useHasPermission("jobs.edit");
  // Allow editing while permission is loading to prevent disabled state during initial load
  const canEditFields = isPermLoading ? true : canEditPermission === true;

  // Check if user is owner or manager (for status dropdown on create)
  const { data: userRole, isLoading: isRoleLoading } = useUserRole();
  // Show dropdown while loading to prevent flash, then hide if staff
  const canSetInitialStatus = isRoleLoading ? true : (userRole === "owner" || userRole === "manager");

  const [selectedClient, setSelectedClient] = React.useState<SelectedClient | null>(null);
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const [customTasks, setCustomTasks] = React.useState<string[]>([]);
  const [outsourcedTasks, setOutsourcedTasks] = React.useState<OutsourcedTask[]>([]);
  const [partsRequests, setPartsRequests] = React.useState<PartRequest[]>([]);
  const [partsEmailSent, setPartsEmailSent] = React.useState(false);
  const [partsApprovalStatus, setPartsApprovalStatus] = React.useState<string>("draft");
  const [usedParts, setUsedParts] = React.useState<{ id: string; part_number: string; added_at: string; synced_to_rollisuite: boolean }[]>([]);
  const [currentStatus, setCurrentStatus] = React.useState<JobStatus>("waiting_approval");
  const [newTask, setNewTask] = React.useState("");
  const [newOutsourcedTask, setNewOutsourcedTask] = React.useState({ description: "", vendor: "" });
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const [duplicateJob, setDuplicateJob] = React.useState<{ id: string; field: "reference" | "estimate"; value: string; watchInfo: string; estimateNumber?: string | null; referenceNumber?: string | null } | null>(null);
  const lookupTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicateCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<FormData>({
    watch_brand: "Rolex",
    watch_model: "",
    reference_number: "",
    estimate_number: "",
    intake_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    notes: "",
    needs_liability_waiver: false,
    waiver_reason: "",
    waiver_signed: false,
  });

  // State for raw date input text (allows typing before validation)
  const [intakeDateInput, setIntakeDateInput] = React.useState("");
  const [dueDateInput, setDueDateInput] = React.useState("");

  // Handle date input - allow free typing, validate on blur
  const handleDateInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setter(e.target.value);
  };

  // Parse "yyyy-MM-dd" string as local date (avoids UTC timezone shift)
  const parseLocalDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return null;
    const [year, month, day] = parts.map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  // Accept:
  // - MMDDYY (e.g. 123125)
  // - MMDDYYYY (e.g. 12312025)
  // - M/D/YY or M/D/YYYY (slashes optional, leading zeros ok)
  const parseFlexibleDateInput = (input: string): Date | null => {
    const t = input.trim();
    if (!t) return null;

    const digits = t.replace(/\D/g, "");

    if (digits.length === 6) {
      const d = parse(digits, "MMddyy", new Date());
      if (!isNaN(d.getTime()) && format(d, "MMddyy") === digits) return d;
      return null;
    }

    if (digits.length === 8) {
      const d = parse(digits, "MMddyyyy", new Date());
      if (!isNaN(d.getTime()) && format(d, "MMddyyyy") === digits) return d;
      return null;
    }

    if (t.includes("/")) {
      const parts = t.split("/").map((p) => p.trim());
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const fmt = parts[2].length === 4 ? "M/d/yyyy" : "M/d/yy";
        const d = parse(t, fmt, new Date());
        if (!isNaN(d.getTime())) return d;
      }
    }

    return null;
  };

  // Auto-complete outsourced tasks and clear waiver when status changes to "finished"
  React.useEffect(() => {
    if (currentStatus === "finished") {
      // Mark all outsourced tasks as finished
      setOutsourcedTasks((tasks) =>
        tasks.map((task) => ({ ...task, status: "finished" as const }))
      );
      // Clear liability waiver requirement
      setFormData((prev) => ({
        ...prev,
        needs_liability_waiver: false,
        waiver_reason: "",
        waiver_signed: false,
      }));
    }
  }, [currentStatus]);

  // Map inspection job_type to service values
  const mapJobTypeToService = (jobType: string): string | null => {
    const mapping: Record<string, string> = {
      "antique_movement": "vintage_movement_service",
      "antique_lv2": "vintage_movement_service",
      "vintage_movement": "vintage_movement_service",
      "vintage_lv2": "vintage_movement_service",
      "modern_movement": "modern_movement_service",
      "modern_lv2": "modern_movement_service",
      "chrono": "modern_movement_service",
      "chrono_lv2": "modern_movement_service",
      "case_work": "case_restoration",
      "small_job": "small_job",
      "warranty": "warranty",
      "stretch_repair": "bracelet_repair",
      "partial_job": "bracelet_repair",
    };
    return mapping[jobType] || null;
  };

  // Load existing job data for edit mode ONCE only
  const hasInitializedRef = React.useRef(false);

  // Fetch approval ID for this job's inspection (for "View Client Response" link)
  const [approvalId, setApprovalId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isEditMode || !editId) return;
    const fetchApproval = async () => {
      const job = (allJobs as any[])?.find((j: any) => j.id === editId);
      const inspectionId = job?.inspection_id;
      if (!inspectionId) return;
      const { data } = await supabase
        .from("inspection_approvals")
        .select("id")
        .eq("inspection_id", inspectionId)
        .eq("status", "approved")
        .maybeSingle();
      if (data) setApprovalId(data.id);
    };
    fetchApproval();
  }, [isEditMode, editId, allJobs]);

  React.useEffect(() => {
    if (!isEditMode || !allJobs || hasInitializedRef.current) return;

    const job = (allJobs as any[]).find((j: any) => j.id === editId) as any;
    if (!job) return;

    // Mark as initialized so we never run this again
    hasInitializedRef.current = true;

    // Set client
    if (job.client_id || job.inspections?.watches?.customers) {
      const customer = job.inspections?.watches?.customers;
      setSelectedClient({
        id: job.client_id || customer?.id,
        name: job.client_name || customer?.name,
        email: job.client_email || customer?.email,
      });
    }

    // Set services - first check existing services, then map from inspection job_type
    const services = job.services as string[] | null;
    if (Array.isArray(services) && services.length > 0) {
      setSelectedServices(services);
    } else if (job.inspections?.job_type) {
      // Map inspection job_type to service
      const mappedService = mapJobTypeToService(job.inspections.job_type);
      if (mappedService) {
        setSelectedServices([mappedService]);
      }
    }

    // Set custom tasks
    const tasks = job.custom_tasks as { description: string; completed: boolean }[] | null;
    if (Array.isArray(tasks)) {
      setCustomTasks(tasks.map((t) => t.description));
    }

    // Set outsourced tasks
    const outsourced = job.outsourced_tasks as OutsourcedTask[] | null;
    if (Array.isArray(outsourced)) {
      setOutsourcedTasks(outsourced);
    }

    // Set parts requests and approval status
    const parts = job.parts_requests as PartRequest[] | null;
    if (Array.isArray(parts)) {
      setPartsRequests(parts);
    }
    if (job.parts_approval_status) {
      setPartsApprovalStatus(job.parts_approval_status);
      // If status is pending or beyond, email was already sent
      if (job.parts_approval_status !== "draft") {
        setPartsEmailSent(true);
      }
    }

    // Set used parts
    const usedPartsData = job.used_parts as { id: string; part_number: string; added_at: string; synced_to_rollisuite: boolean }[] | null;
    if (Array.isArray(usedPartsData)) {
      setUsedParts(usedPartsData);
    }

    // Set form data - use watch target_date for due_date if job due_date not set
    const watch = job.inspections?.watches;
    const hasWaiverRequired = job.needs_liability_waiver || job.inspections?.waiver_required || false;

    // Priority: job.due_date > watch.target_date > calculated
    const dueDate = job.due_date || watch?.target_date || "";

    setFormData({
      watch_brand: job.watch_brand || watch?.brand || "Rolex",
      watch_model: job.watch_model || watch?.model || "",
      reference_number: job.serial_number || watch?.reference_number || "",
      estimate_number: job.estimate_number || watch?.estimate_number || "",
      intake_date: job.intake_date || format(new Date(), "yyyy-MM-dd"),
      due_date: dueDate,
      notes: job.notes || "",
      needs_liability_waiver: hasWaiverRequired,
      waiver_reason: job.waiver_reason || "",
      waiver_signed: job.waiver_signed || false,
    });

    // Set current status
    if (job.status) {
      setCurrentStatus(job.status as JobStatus);
    }
  }, [isEditMode, editId, allJobs]);

  // Calculate due date from services
  const calculateDueDate = React.useCallback((services: string[]) => {
    if (services.length === 0) return "";
    
    // Validate intake_date before parsing
    if (!formData.intake_date) return "";
    
    const intakeDate = new Date(formData.intake_date);
    
    // Check if date is valid
    if (isNaN(intakeDate.getTime())) return "";
    
    let maxWeeks = 0;
    let maxDays = 0;

    services.forEach((serviceValue) => {
      const service = SERVICE_TYPES.find((s) => s.value === serviceValue);
      if (service) {
        if (service.weeks && service.weeks > maxWeeks) {
          maxWeeks = service.weeks;
        }
        if (service.days && service.days > maxDays) {
          maxDays = service.days;
        }
      }
    });

    if (maxWeeks > 0) {
      return format(addWeeks(intakeDate, maxWeeks), "yyyy-MM-dd");
    } else if (maxDays > 0) {
      return format(addDays(intakeDate, maxDays), "yyyy-MM-dd");
    }
    return "";
  }, [formData.intake_date]);

  // Recalculate due date when services or intake date changes
  React.useEffect(() => {
    if (!isEditMode || !formData.due_date) {
      const newDueDate = calculateDueDate(selectedServices);
      if (newDueDate) {
        setFormData((prev) => ({ ...prev, due_date: newDueDate }));
      }
    }
  }, [selectedServices, formData.intake_date, calculateDueDate, isEditMode]);

  // Get model suggestions based on brand
  const getModelSuggestions = React.useMemo(() => {
    const input = formData.watch_model.toLowerCase();
    const models = getModelsByBrand(formData.watch_brand);

    return models.filter((m) => m.toLowerCase().includes(input)).slice(0, 10);
  }, [formData.watch_brand, formData.watch_model]);

  const handleServiceToggle = (serviceValue: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceValue)
        ? prev.filter((s) => s !== serviceValue)
        : [...prev, serviceValue]
    );
  };

  // Check for duplicate jobs by reference or estimate number
  const checkForDuplicateJob = React.useCallback(async (field: "reference" | "estimate", value: string) => {
    if (!value.trim() || isEditMode) return;
    
    // Clear existing timeout
    if (duplicateCheckTimeoutRef.current) {
      clearTimeout(duplicateCheckTimeoutRef.current);
    }
    
    duplicateCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const trimmed = value.trim();
        // Check both estimate_number and serial_number for a match
        const orFilter = field === "estimate"
          ? `estimate_number.eq.${trimmed},serial_number.eq.${trimmed}`
          : `serial_number.eq.${trimmed},estimate_number.eq.${trimmed}`;
        
        const { data: existingJobs, error } = await supabase
          .from("jobs")
          .select("id, watch_brand, watch_model, estimate_number, serial_number, client_name, status")
          .or(orFilter)
          .limit(3);
        
        // Filter out finished jobs for stronger duplicate signal, but still warn
        const activeMatch = existingJobs?.find(j => j.status !== "finished");
        const anyMatch = activeMatch || existingJobs?.[0];

        if (!error && anyMatch) {
          const watchInfo = [anyMatch.watch_brand, anyMatch.watch_model, anyMatch.client_name]
            .filter(Boolean)
            .join(" • ");
          setDuplicateJob({
            id: anyMatch.id,
            field,
            value: trimmed,
            watchInfo: watchInfo || "Unknown watch",
            estimateNumber: anyMatch.estimate_number,
            referenceNumber: anyMatch.serial_number,
          });
        } else {
          // Only clear if the current duplicate is for this field
          setDuplicateJob((prev) => (prev?.field === field ? null : prev));
        }
      } catch (err) {
        console.error("Error checking for duplicate:", err);
      }
    }, 400);
  }, [isEditMode]);

  // Lookup watch by reference number
  const handleReferenceNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // First, check for auto-detection from reference prefix
    const detected = detectWatchFromReference(value);
    if (detected) {
      setFormData((p) => ({ 
        ...p, 
        reference_number: value,
        watch_brand: detected.brand,
        watch_model: detected.model,
      }));
    } else {
      setFormData((p) => ({ ...p, reference_number: value }));
    }

    // Check for duplicate job
    checkForDuplicateJob("reference", value);

    // Clear existing timeout
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    // Debounce database lookup (only if not already detected)
    if (!detected && value.trim().length >= 3) {
      lookupTimeoutRef.current = setTimeout(async () => {
        setIsLookingUp(true);
        try {
          const { data: watch, error } = await supabase
            .from("watches")
            .select("brand, model, reference_number")
            .eq("reference_number", value.trim())
            .maybeSingle();

          if (!error && watch) {
            setFormData((p) => ({
              ...p,
              watch_brand: watch.brand || p.watch_brand,
              watch_model: watch.model || "",
            }));
            toast.success(`Found watch: ${watch.brand} ${watch.model || ""}`);
          }
        } catch (err) {
          console.error("Error looking up watch:", err);
        } finally {
          setIsLookingUp(false);
        }
      }, 500);
    }
  };

  // Handle estimate number change with duplicate check
  const handleEstimateNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((p) => ({ ...p, estimate_number: value }));
    checkForDuplicateJob("estimate", value);
  };

  const handleAddTask = () => {
    const trimmed = newTask.trim();
    if (trimmed) {
      setCustomTasks((prev) => [...prev, trimmed]);
      setNewTask("");
    }
  };

  const handleRemoveTask = (index: number) => {
    setCustomTasks((prev) => prev.filter((_, i) => i !== index));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: newJob, error } = await supabase
        .from("jobs")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return newJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job created successfully");
      navigate("/work-queue");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to create job");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { data: updated, error } = await supabase
        .from("jobs")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // If waiver is now required and wasn't before, create a draft waiver
      if (data.needs_liability_waiver) {
        // Check if a draft waiver already exists for this job
        const { data: existingWaiver } = await supabase
          .from("liability_waivers")
          .select("id")
          .eq("job_id", id)
          .in("status", ["draft", "pending"])
          .maybeSingle();

        if (!existingWaiver) {
          // Create a new draft waiver
          await supabase
            .from("liability_waivers")
            .insert({
              job_id: id,
              status: "draft",
              customer_name: data.client_name,
              customer_email: data.client_email,
              watch_brand: data.watch_brand,
              watch_model: data.watch_model,
              serial_number: data.serial_number,
            });
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job updated successfully");
      navigate("/work-queue");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update job");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      toast.error("Please select a client");
      return;
    }

    if (selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }

    const isMovementService = selectedServices.some((s) => {
      const service = SERVICE_TYPES.find((t) => t.value === s);
      return service?.isMovement;
    });

    // Map frontend service names to DB-valid service_type values
    const serviceTypeMap: Record<string, string> = {
      modern_movement_service: "modern_movement",
      vintage_movement_service: "vintage_movement",
      antique_movement_service: "antique_movement",
      bracelet_repair: "bracelet_repair",
      gold_bracelet_repair: "gold_bracelet",
      case_restoration: "case_restoration",
      warranty: "warranty",
      small_job: "small_job",
    };

    // Pick the service_type from the longest-duration selected service
    let resolvedServiceType: string = "other";
    let maxDuration = 0;
    for (const svc of selectedServices) {
      const def = SERVICE_TYPES.find((t) => t.value === svc);
      const duration = def?.weeks ? def.weeks * 7 : (def?.days ?? 0);
      if (duration > maxDuration) {
        maxDuration = duration;
        resolvedServiceType = serviceTypeMap[svc] || "other";
      }
    }

    // Auto-complete outsourced tasks when job is marked finished
    const finalOutsourcedTasks = currentStatus === "finished"
      ? outsourcedTasks.map((task) => ({ ...task, status: "complete" as const }))
      : outsourcedTasks;

    const jobData = {
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      client_email: selectedClient.email,
      watch_brand: formData.watch_brand,
      watch_model: formData.watch_model,
      serial_number: formData.reference_number,
      estimate_number: formData.estimate_number || null,
      services: selectedServices,
      service_type: resolvedServiceType,
      custom_tasks: customTasks.map((desc) => ({ description: desc, completed: false })),
      outsourced_tasks: finalOutsourcedTasks,
      parts_requests: partsRequests,
      parts_approval_status: partsApprovalStatus,
      used_parts: usedParts,
      intake_date: formData.intake_date,
      due_date: formData.due_date,
      status: currentStatus,
      is_movement_service: isMovementService,
      needs_liability_waiver: formData.needs_liability_waiver,
      waiver_reason: formData.needs_liability_waiver ? formData.waiver_reason : "",
      waiver_signed: formData.needs_liability_waiver ? formData.waiver_signed : false,
      notes: formData.notes,
    };

    if (isEditMode) {
      updateMutation.mutate({ id: editId, ...jobData });
    } else {
      createMutation.mutate(jobData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Print job summary
  const handlePrint = () => {
    const serviceLabels = selectedServices
      .map((s) => SERVICE_TYPES.find((t) => t.value === s)?.label || s)
      .join(", ");

    const printContent = `
      <html>
        <head>
          <title>Job Summary</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: 600; font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
            .section-content { font-size: 16px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            ul { margin: 0; padding-left: 20px; }
            li { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h1>ROLLIWORKS JOB SUMMARY</h1>
          
          <div class="section">
            <div class="section-title">Client</div>
            <div class="section-content">${selectedClient?.name || "Not selected"}${selectedClient?.email ? ` (${selectedClient.email})` : ""}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Watch Details</div>
            <div class="section-content">
              ${formData.watch_brand} ${formData.watch_model || ""}${formData.reference_number ? ` (Ref: ${formData.reference_number})` : ""}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Services</div>
            <div class="section-content">${serviceLabels || "None selected"}</div>
          </div>
          
          <div class="grid">
            <div class="section">
              <div class="section-title">Intake Date</div>
              <div class="section-content">${formData.intake_date ? format(new Date(formData.intake_date), "MMM d, yyyy") : "Not set"}</div>
            </div>
            <div class="section">
              <div class="section-title">Due Date</div>
              <div class="section-content">${formData.due_date ? format(new Date(formData.due_date), "MMM d, yyyy") : "Not set"}</div>
            </div>
          </div>
          
          ${customTasks.length > 0 ? `
          <div class="section">
            <div class="section-title">Custom Tasks</div>
            <ul>
              ${customTasks.map((t) => `<li>${t}</li>`).join("")}
            </ul>
          </div>
          ` : ""}
          
          ${formData.notes ? `
          <div class="section">
            <div class="section-title">Notes</div>
            <div class="section-content">${formData.notes.replace(/\n/g, "<br>")}</div>
          </div>
          ` : ""}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/work-queue">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditMode ? "Edit Job" : "New Job"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/work-queue">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Link>
          </Button>
          {isEditMode ? (
            <Button type="submit" form="job-form" className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          ) : (
            <Button type="submit" form="job-form">
              Create Job
            </Button>
          )}
        </div>
      </header>

      {/* View Client Response link */}
      {isEditMode && approvalId && (
        <button
          type="button"
          onClick={() => window.open(`${window.location.origin}/view-approval?id=${approvalId}`, '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 transition-colors dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer"
        >
          <ExternalLink className="h-4 w-4" />
          View Client Approval Response
        </button>
      )}

      {/* Status Stepper - only show in edit mode */}
      {isEditMode && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3">
            <JobStatusStepper
              currentStatus={currentStatus}
              onStatusChange={setCurrentStatus}
            />
          </CardContent>
        </Card>
      )}

      {/* Status Dropdown - for owners/managers (create + edit) */}
      {canSetInitialStatus && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">
                {isEditMode ? "Status" : "Initial Status"}
              </Label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as JobStatus)}
                className="flex h-9 w-full max-w-xs items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-1.5 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {JOB_STATUS_ORDER.map((status) => (
                  <option key={status} value={status} className="bg-background text-foreground">
                    {JOB_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inspection Notes - show in edit mode when inspection exists */}
      {isEditMode && (() => {
        const job = (allJobs as any[])?.find((j: any) => j.id === editId);
        const inspection = job?.inspections;
        if (!inspection) return null;
        return (
          <Card className="border-0 shadow-sm border-l-4 border-l-teal-500">
            <CardContent className="py-3">
              <ReadOnlyInspectionNotes inspection={inspection} />
            </CardContent>
          </Card>
        );
      })()}

      <form id="job-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Liability Waiver */}
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-600">⚠</span>
                <span className="font-medium text-foreground">Liability Waiver</span>
              </div>
              <Switch
                checked={formData.needs_liability_waiver}
                onCheckedChange={(c) => setFormData((p) => ({ ...p, needs_liability_waiver: c }))}
                disabled={!canEditFields}
              />
            </div>
            {formData.needs_liability_waiver && (
              <div className="mt-3">
                <Input
                  value={formData.waiver_reason}
                  onChange={(e) => setFormData((p) => ({ ...p, waiver_reason: e.target.value }))}
                  placeholder="Waiver reason (e.g., Fragile dial)"
                  disabled={!canEditFields}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Outsourced Tasks */}
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">📦</span>
              <span className="font-medium text-foreground">Outsourced Tasks</span>
            </div>
            {canEditFields && (
              <div className="flex gap-2">
                <Input
                  value={newOutsourcedTask.description}
                  onChange={(e) => setNewOutsourcedTask((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Task description"
                  className="flex-1 h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newOutsourcedTask.description.trim()) {
                      setOutsourcedTasks((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          description: newOutsourcedTask.description.trim(),
                          vendor: "",
                          status: "pending",
                        },
                      ]);
                      setNewOutsourcedTask({ description: "", vendor: "" });
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            )}
            {outsourcedTasks.length > 0 && (
              <div className="space-y-1.5">
                {outsourcedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded-md border bg-muted/30"
                  >
                    <span className="text-sm truncate flex-1">{task.description}</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={task.status}
                        onChange={(e) => {
                          setOutsourcedTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id
                                ? { ...t, status: e.target.value as OutsourcedTask["status"] }
                                : t
                            )
                          );
                        }}
                        disabled={!canEditFields}
                        className="h-7 text-xs rounded border border-input bg-background px-1.5 disabled:opacity-50"
                      >
                        <option value="pending">Pending</option>
                        <option value="sent">Sent</option>
                        <option value="finished">Finished</option>
                      </select>
                      {canEditFields && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setOutsourcedTasks((prev) => prev.filter((t) => t.id !== task.id))
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {outsourcedTasks.length === 0 && !canEditFields && (
              <p className="text-sm text-muted-foreground text-center">No outsourced tasks</p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Client Selection */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3">
            <Label className="text-sm font-medium mb-2 block">Client</Label>
            <ClientSelector value={selectedClient} onChange={setSelectedClient} disabled={!canEditFields} />
          </CardContent>
        </Card>

        {/* Section 2: Watch Details */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 space-y-3">
            <Label className="text-sm font-medium">Watch Details</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brand *</Label>
                <select
                  value={formData.watch_brand}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      watch_brand: e.target.value,
                      watch_model: "",
                    }))
                  }
                  aria-label="Watch brand"
                  disabled={!canEditFields}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Rolex">Rolex</option>
                  <option value="Tudor">Tudor</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1 relative">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Input
                  value={formData.watch_model}
                  onChange={(e) => setFormData((p) => ({ ...p, watch_model: e.target.value }))}
                  onFocus={() => !canEditFields ? null : setModelOpen(true)}
                  onBlur={() => setTimeout(() => setModelOpen(false), 200)}
                  placeholder="Model"
                  disabled={!canEditFields}
                  className="h-9"
                />
                {modelOpen && getModelSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {getModelSuggestions.map((model) => (
                      <button
                        key={model}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted border-b last:border-b-0"
                        onClick={() => {
                          setFormData((p) => ({ ...p, watch_model: model }));
                          setModelOpen(false);
                        }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reference #</Label>
                <Input
                  value={formData.reference_number}
                  onChange={handleReferenceNumberChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Reference"
                  disabled={!canEditFields}
                  className="h-9"
                />
                {isLookingUp && (
                  <p className="text-xs text-muted-foreground">Looking up...</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estimate #</Label>
                <Input
                  value={formData.estimate_number}
                  onChange={handleEstimateNumberChange}
                  placeholder="Estimate"
                  disabled={!canEditFields}
                  className="h-9"
                />
              </div>
            </div>
            
            {/* Duplicate Job Alert */}
            {duplicateJob && !isEditMode && (
              <div className="mt-3 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Possible duplicate job found
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      A job already exists
                      {duplicateJob.estimateNumber && ` • Estimate #: ${duplicateJob.estimateNumber}`}
                      {duplicateJob.referenceNumber && ` • Ref #: ${duplicateJob.referenceNumber}`}
                      {duplicateJob.watchInfo && ` (${duplicateJob.watchInfo})`}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/new-job?edit=${duplicateJob.id}`)}
                      >
                        Edit Existing Job
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setDuplicateJob(null)}
                      >
                        Create New Anyway
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Services */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3">
            <Label className="text-sm font-medium mb-2 block">Services *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TYPES.map((service) => (
                <div
                  key={service.value}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-md border transition-colors",
                    canEditFields ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed",
                    selectedServices.includes(service.value) && "bg-primary/5 border-primary/30"
                  )}
                  onClick={() => canEditFields && handleServiceToggle(service.value)}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.value)}
                    onChange={() => canEditFields && handleServiceToggle(service.value)}
                    disabled={!canEditFields}
                    className="h-3.5 w-3.5 rounded border-primary text-primary focus:ring-primary disabled:opacity-50"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{service.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.weeks ? `${service.weeks}w` : `${service.days}d`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Custom Tasks */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 space-y-2">
            <Label className="text-sm font-medium">Custom Tasks</Label>
            {canEditFields && (
              <div className="flex gap-2">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Enter custom task..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  className="flex-1 h-9"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddTask}>
                  Add
                </Button>
              </div>
            )}
            {customTasks.length > 0 && (
              <div className="space-y-1.5">
                {customTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-2 rounded-md border bg-muted/30"
                  >
                    <span className="text-sm truncate">{task}</span>
                    {canEditFields && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveTask(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!canEditFields && customTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">No custom tasks</p>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Schedule & Notes */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 space-y-3">
            <Label className="text-sm font-medium">Schedule & Notes</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Intake Date *</Label>
                <Popover>
                  <div className="relative">
                    <Input
                      value={intakeDateInput || (formData.intake_date ? format(parseLocalDate(formData.intake_date) || new Date(), "MM/dd/yy") : "")}
                      onChange={(e) => handleDateInputChange(e, setIntakeDateInput)}
                      onBlur={() => {
                        const parsed = parseFlexibleDateInput(intakeDateInput);
                        if (intakeDateInput && parsed) {
                          setFormData((p) => ({ ...p, intake_date: format(parsed, "yyyy-MM-dd") }));
                          setIntakeDateInput("");
                        } else if (!intakeDateInput) {
                        } else {
                          setIntakeDateInput("");
                        }
                      }}
                      onFocus={() => {
                        if (formData.intake_date && !intakeDateInput) {
                          setIntakeDateInput(format(parseLocalDate(formData.intake_date) || new Date(), "MM/dd/yy"));
                        }
                      }}
                      placeholder="MM/DD/YY"
                      className="pr-9 h-9"
                      disabled={!canEditFields}
                    />
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-2.5 hover:bg-transparent">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.intake_date ? parseLocalDate(formData.intake_date) || undefined : undefined}
                      onSelect={(date) => {
                        setFormData((p) => ({ ...p, intake_date: date ? format(date, "yyyy-MM-dd") : "" }));
                        setIntakeDateInput("");
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Due Date *</Label>
                <Popover>
                  <div className="relative">
                    <Input
                      value={dueDateInput || (formData.due_date ? format(parseLocalDate(formData.due_date) || new Date(), "MM/dd/yy") : "")}
                      onChange={(e) => handleDateInputChange(e, setDueDateInput)}
                      onBlur={() => {
                        const parsed = parseFlexibleDateInput(dueDateInput);
                        if (dueDateInput && parsed) {
                          setFormData((p) => ({ ...p, due_date: format(parsed, "yyyy-MM-dd") }));
                          setDueDateInput("");
                        } else if (!dueDateInput) {
                        } else {
                          setDueDateInput("");
                        }
                      }}
                      onFocus={() => {
                        if (formData.due_date && !dueDateInput) {
                          setDueDateInput(format(parseLocalDate(formData.due_date) || new Date(), "MM/dd/yy"));
                        }
                      }}
                      placeholder="MM/DD/YY"
                      className="pr-9 h-9"
                      disabled={!canEditFields}
                    />
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-2.5 hover:bg-transparent">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date ? parseLocalDate(formData.due_date) || undefined : undefined}
                      onSelect={(date) => {
                        setFormData((p) => ({ ...p, due_date: date ? format(date, "yyyy-MM-dd") : "" }));
                        setDueDateInput("");
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Initial notes about the job"
                rows={2}
                disabled={!canEditFields}
              />
            </div>
          </CardContent>
        </Card>

        {/* Parts Requests - Staff can add, Manager/Owner can price */}
        <PartsRequestSection
          partsRequests={partsRequests}
          onChange={setPartsRequests}
          jobId={editId || undefined}
          clientEmail={selectedClient?.email}
          clientName={selectedClient?.name}
          watchBrand={formData.watch_brand}
          watchModel={formData.watch_model}
          estimateNumber={formData.estimate_number}
          referenceNumber={formData.reference_number}
          onCancel={() => navigate("/work-queue")}
          onPrint={handlePrint}
          onSave={() => {
            // Trigger form submission
            const form = document.querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }}
          isSaving={isPending}
          onEmailSent={async (updatedParts) => {
            setPartsEmailSent(true);
            setPartsApprovalStatus("pending");
            setPartsRequests(updatedParts);
            
            // Auto-save to database immediately using RPC (works for all roles)
            if (editId) {
              const result = await updatePartsWithStatus(editId, updatedParts, "pending");
              if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["jobs"] });
              } else {
                console.error("Failed to save email sent status:", result.error);
                toast.error("Failed to save parts request");
              }
            }
          }}
          onApprovalStatusChange={async (status, updatedParts) => {
            // Check if any parts are on_order
            const hasOnOrder = updatedParts.some((p) => p.status === "on_order");
            const newStatus = hasOnOrder 
              ? "on_order" 
              : status === "approved" 
                ? "approved" 
                : status === "declined" 
                  ? "denied" 
                  : "pending";
            setPartsApprovalStatus(newStatus);
            setPartsRequests(updatedParts);
            
            // Auto-save to database immediately using RPC (works for all roles)
            if (editId) {
              const result = await updatePartsWithStatus(editId, updatedParts, newStatus);
              if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["jobs"] });
              } else {
                console.error("Failed to save approval status:", result.error);
                toast.error("Failed to save parts request");
              }
            }
          }}
        />

        {/* Used Parts - Barcode scanner bulk entry */}
        {isEditMode && (
          <UsedPartsSection
            jobId={editId}
            usedParts={usedParts}
            onChange={setUsedParts}
            estimateNumber={formData.estimate_number}
            watchBrand={formData.watch_brand}
            watchModel={formData.watch_model}
            customerName={selectedClient?.name}
            disabled={!canEditFields}
          />
        )}

        {/* Form Actions */}
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/work-queue">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-primary hover:bg-primary/90"
            disabled={isPending}
          >
            {isPending ? (
              isEditMode ? "Saving..." : "Creating..."
            ) : (
              <>
                {isEditMode ? "Save Changes" : "Create Job"}
                <Save className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Delete Job Section - Only in edit mode */}
        {isEditMode && (
          <DeleteJobSection jobId={editId} />
        )}
      </form>
    </main>
  );
};

export default NewJob;
