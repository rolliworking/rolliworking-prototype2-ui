import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { FileWarning, Send, Loader2, History, Pencil, Trash2, Clock, CheckCircle2, FileText, Eye, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface Job {
  id: string;
  client_name: string | null;
  client_email: string | null;
  client_id: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  serial_number: string | null;
  status: string;
  inspection?: {
    id: string;
    watch?: {
      id: string;
      estimate_number: string;
      reference_number: string | null;
    };
  };
}

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

export default function LiabilityWaiver() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editParam = searchParams.get("edit");
  
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [waiverDate, setWaiverDate] = useState<Date>(new Date());
  const [customerName, setCustomerName] = useState("");
  const [dialDefects, setDialDefects] = useState(false);
  const [handDefects, setHandDefects] = useState(false);
  const [additionalComponents, setAdditionalComponents] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingWaiverId, setEditingWaiverId] = useState<string | null>(editParam);
  const [deleteWaiverId, setDeleteWaiverId] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");

  // Fetch email template
  const { data: templates = [] } = useEmailTemplates();
  
  // Fetch waiver history
  const { data: waivers = [], refetch: refetchWaivers } = useQuery({
    queryKey: ["liability-waivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liability_waivers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LiabilityWaiverRecord[];
    },
  });

  // Get the liability waiver template
  const waiverTemplate = useMemo(() => {
    return templates.find(t => t.type === "liability_waiver");
  }, [templates]);

  // Fetch active jobs (not finished)
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs-for-waiver"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,
          client_name,
          client_email,
          client_id,
          watch_brand,
          watch_model,
          serial_number,
          status,
          inspection_id
        `)
        .neq("status", "finished")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch inspection, watch, and customer details for each job with inspection_id
      const jobsWithDetails = await Promise.all(
        (data || []).map(async (job) => {
          let enrichedJob = { ...job };
          
          if (job.inspection_id) {
            const { data: inspection } = await supabase
              .from("inspections")
              .select("id, watch_id")
              .eq("id", job.inspection_id)
              .maybeSingle();

            if (inspection?.watch_id) {
              const { data: watch } = await supabase
                .from("watches")
                .select("id, estimate_number, reference_number, brand, model, customer_id")
                .eq("id", inspection.watch_id)
                .maybeSingle();

              if (watch) {
                // Fallback to watch details if job doesn't have them
                if (!enrichedJob.watch_brand && watch.brand) {
                  enrichedJob.watch_brand = watch.brand;
                }
                if (!enrichedJob.watch_model && watch.model) {
                  enrichedJob.watch_model = watch.model;
                }
                if (!enrichedJob.serial_number && watch.reference_number) {
                  enrichedJob.serial_number = watch.reference_number;
                }

                // Fetch customer name if job doesn't have client_name
                if (!enrichedJob.client_name && watch.customer_id) {
                  const { data: customer } = await supabase
                    .from("customers")
                    .select("name, email")
                    .eq("id", watch.customer_id)
                    .maybeSingle();

                  if (customer) {
                    enrichedJob.client_name = customer.name;
                    if (!enrichedJob.client_email) {
                      enrichedJob.client_email = customer.email;
                    }
                  }
                }

                return {
                  ...enrichedJob,
                  inspection: {
                    id: inspection.id,
                    watch: { id: watch.id, estimate_number: watch.estimate_number, reference_number: watch.reference_number },
                  },
                };
              }
            }
          }
          return enrichedJob;
        })
      );

      return jobsWithDetails as Job[];
    },
  });

  // Filter jobs based on search query
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();

    return Boolean(
      job.client_name?.toLowerCase().includes(query) ||
        job.client_email?.toLowerCase().includes(query) ||
        job.serial_number?.toLowerCase().includes(query) ||
        job.inspection?.watch?.reference_number?.toLowerCase().includes(query) ||
        job.inspection?.watch?.estimate_number?.toLowerCase().includes(query)
    );
  });

  // If the search uniquely identifies a job (or is an exact match), auto-select it
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    const exact = filteredJobs.find(
      (job) =>
        job.serial_number?.toLowerCase() === q ||
        job.inspection?.watch?.reference_number?.toLowerCase() === q ||
        job.inspection?.watch?.estimate_number?.toLowerCase() === q
    );

    const candidate = exact ?? (filteredJobs.length === 1 ? filteredJobs[0] : null);
    if (candidate && candidate.id !== selectedJobId) {
      setSelectedJobId(candidate.id);
    }
  }, [searchQuery, filteredJobs, selectedJobId]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Auto-populate customer name when job is selected
  useEffect(() => {
    if (selectedJob?.client_name) {
      setCustomerName(selectedJob.client_name);
    }
  }, [selectedJob]);

  // Load draft waiver for editing
  useEffect(() => {
    if (editingWaiverId) {
      const waiver = waivers.find((w) => w.id === editingWaiverId);
      if (waiver) {
        setSelectedJobId(waiver.job_id || "");
        setCustomerName(waiver.customer_name || "");
        setDialDefects(waiver.dial_defects);
        setHandDefects(waiver.hand_defects);
        setAdditionalComponents(waiver.additional_components || "");
        setAdditionalInfo(waiver.additional_info || "");
        if (waiver.waiver_date) {
          setWaiverDate(new Date(waiver.waiver_date));
        }
        // Waiver loaded for editing
      }
    }
  }, [editingWaiverId, waivers]);

  const getJobDisplayLabel = (job: Job) => {
    const parts = [];
    if (job.client_name) parts.push(job.client_name);
    if (job.watch_brand) parts.push(job.watch_brand);
    if (job.watch_model) parts.push(job.watch_model);
    if (job.serial_number) parts.push(`#${job.serial_number}`);
    return parts.length > 0 ? parts.join(" - ") : `Job ${job.id.slice(0, 8)}`;
  };

  const getAreasOfConcern = () => {
    const areas = [];
    if (dialDefects) areas.push("Dial Defects");
    if (handDefects) areas.push("Hand Defects");
    if (additionalComponents.trim()) areas.push(additionalComponents.trim());
    return areas.join(", ");
  };

  const getClientFirstName = (fullName: string | null) => {
    if (!fullName) return "Valued Customer";
    return fullName.split(" ")[0];
  };

  // Build the default email body from template
  const buildDefaultEmailBody = useMemo(() => {
    const watchDetails = selectedJob 
      ? [selectedJob.watch_brand, selectedJob.watch_model].filter(Boolean).join(" ") || "Your Watch"
      : "Your Watch";
    const referenceNumber = selectedJob?.inspection?.watch?.reference_number || "";
    const serialNumber = selectedJob?.serial_number || "";
    const customerFirstName = getClientFirstName(selectedJob?.client_name || null);
    const areasOfConcern = getAreasOfConcern();

    // Waiver terms to include
    const waiverTerms = `AREAS OF CONCERN
${areasOfConcern || "N/A"}
${dialDefects ? "• Dial Defects" : ""}${handDefects ? "\n• Hand Defects" : ""}${additionalComponents.trim() ? `\n• ${additionalComponents.trim()}` : ""}

${additionalInfo.trim() ? `ADDITIONAL INFORMATION\n${additionalInfo.trim()}\n\n` : ""}---

I, the undersigned, understand and acknowledge that the above watch has pre-existing condition issues at the time it was presented for service.

I further understand and agree to the following:

1. Pre-Existing Condition - The damage has been disclosed and acknowledged by both the customer and Rolliworks.

2. Limitation of Liability - Rolliworks will take reasonable care during the repair process, but due to the fragile nature of the above noted part(s) and its existing damage, the company will not be held responsible for any additional cracking, chipping, fading, scratching, or other damage that may occur during a responsible and careful service process.

3. Customer Acceptance - I accept full responsibility for the pre-existing condition of the above noted part(s) and release Rolliworks, its employees, and representatives from any liability relating to the condition during or after service.

---

Please reply back "APPROVED" to accept or "DECLINE" to pause work.`;

    if (waiverTemplate) {
      // Replace placeholders in template body
      let body = waiverTemplate.body
        .replace(/\{\{customer_first_name\}\}/g, customerFirstName)
        .replace(/\{\{watch_brand\}\}/g, selectedJob?.watch_brand || "")
        .replace(/\{\{watch_model\}\}/g, selectedJob?.watch_model || "")
        .replace(/\{\{reference_number\}\}/g, referenceNumber)
        .replace(/\{\{serial_number\}\}/g, serialNumber)
        .replace(/\{\{watch_details\}\}/g, watchDetails)
        .replace(/\{\{dial_defects\}\}/g, dialDefects ? "Yes" : "No")
        .replace(/\{\{hand_defects\}\}/g, handDefects ? "Yes" : "No")
        .replace(/\{\{additional_components\}\}/g, additionalComponents.trim() || "N/A")
        .replace(/\{\{additional_info\}\}/g, additionalInfo.trim() || "N/A")
        .replace(/\{\{waiver_link\}\}/g, "[Signing link will be inserted here]");

      // Insert waiver terms before "Thank you" line
      const thankYouIndex = body.toLowerCase().indexOf("thank you");
      if (thankYouIndex > -1) {
        body = body.slice(0, thankYouIndex) + waiverTerms + "\n\n" + body.slice(thankYouIndex);
      } else {
        body = body + "\n\n" + waiverTerms;
      }

      return body;
    }

    // Fallback template if no template found
    return `Dear ${customerFirstName},

Due to concerns regarding the durability of certain parts during the service process, we kindly request that you complete a release of liability waiver before we proceed with your job.

WATCH DETAILS
${watchDetails}${referenceNumber ? `\nRef #: ${referenceNumber}` : ""}${serialNumber ? `\nRef #: ${serialNumber}` : ""}

${waiverTerms}

Thank you for your understanding and cooperation.

Best,
Ivy P.

Rolliworks
14 N.E. 1st Ave Ste 403
Miami FL 33132
408-800-3244
M-F 9am to 5pm | Sat-Sun: Closed`;
  }, [selectedJob, dialDefects, handDefects, additionalComponents, additionalInfo, waiverTemplate]);

  // Build default email subject
  const buildDefaultEmailSubject = useMemo(() => {
    const watchDetails = selectedJob 
      ? [selectedJob.watch_brand, selectedJob.watch_model].filter(Boolean).join(" ") || "Your Watch"
      : "Your Watch";
    const referenceNumber = selectedJob?.inspection?.watch?.reference_number || "";
    
    if (waiverTemplate) {
      return waiverTemplate.subject
        .replace(/\{\{watch_brand\}\}/g, selectedJob?.watch_brand || "")
        .replace(/\{\{watch_model\}\}/g, selectedJob?.watch_model || "")
        .replace(/\{\{reference_number\}\}/g, referenceNumber);
    }
    
    return `Release of Liability Waiver for ${watchDetails}`;
  }, [selectedJob, waiverTemplate]);

  // Initialize email body and subject when template or job changes
  useEffect(() => {
    setEmailBody(buildDefaultEmailBody);
  }, [buildDefaultEmailBody]);

  useEffect(() => {
    setEmailSubject(buildDefaultEmailSubject);
  }, [buildDefaultEmailSubject]);

  const resetForm = () => {
    setSelectedJobId("");
    setCustomerName("");
    setDialDefects(false);
    setHandDefects(false);
    setAdditionalComponents("");
    setAdditionalInfo("");
    setAuthorized(false);
    setWaiverDate(new Date());
    setEditingWaiverId(null);
    setEmailBody("");
    setEmailSubject("");
  };

  const handleSaveDraft = async () => {
    if (!selectedJob) {
      toast.error("Please select a job");
      return;
    }

    try {
      const waiverData = {
        job_id: selectedJob.id,
        status: "draft" as const,
        customer_name: customerName.trim() || selectedJob.client_name,
        customer_email: selectedJob.client_email,
        watch_brand: selectedJob.watch_brand,
        watch_model: selectedJob.watch_model,
        serial_number: selectedJob.serial_number,
        estimate_number: selectedJob.inspection?.watch?.estimate_number || null,
        reference_number: selectedJob.inspection?.watch?.reference_number || null,
        dial_defects: dialDefects,
        hand_defects: handDefects,
        additional_components: additionalComponents.trim() || null,
        additional_info: additionalInfo.trim() || null,
        waiver_date: format(waiverDate, "yyyy-MM-dd"),
      };

      if (editingWaiverId) {
        const { error } = await supabase
          .from("liability_waivers")
          .update(waiverData)
          .eq("id", editingWaiverId);
        if (error) throw error;
        toast.success("Waiver draft updated");
      } else {
        const { error } = await supabase
          .from("liability_waivers")
          .insert(waiverData);
        if (error) throw error;
        toast.success("Waiver saved as draft");
      }

      refetchWaivers();
      resetForm();
    } catch (error: any) {
      console.error("Error saving waiver:", error);
      toast.error(error.message || "Failed to save waiver");
    }
  };


  const handleSendWaiverEmail = async () => {
    if (!selectedJob) {
      toast.error("Please select a job");
      return;
    }
    if (!dialDefects && !handDefects && !additionalComponents.trim()) {
      toast.error("Please select at least one area of concern");
      return;
    }
    if (!selectedJob.client_email) {
      toast.error("Customer email is required to send waiver");
      return;
    }

    setIsSending(true);

    try {
      // Save waiver as pending first
      const waiverData = {
        job_id: selectedJob.id,
        status: "pending" as const,
        customer_name: null,
        customer_email: selectedJob.client_email,
        watch_brand: selectedJob.watch_brand,
        watch_model: selectedJob.watch_model,
        serial_number: selectedJob.serial_number,
        estimate_number: selectedJob.inspection?.watch?.estimate_number || null,
        reference_number: selectedJob.inspection?.watch?.reference_number || null,
        dial_defects: dialDefects,
        hand_defects: handDefects,
        additional_components: additionalComponents.trim() || null,
        additional_info: additionalInfo.trim() || null,
        waiver_date: format(waiverDate, "yyyy-MM-dd"),
      };

      let waiverNumber: string | null = null;

      if (editingWaiverId) {
        const existingWaiver = waivers.find((w) => w.id === editingWaiverId);
        waiverNumber = existingWaiver?.waiver_number || null;
        
        const { error } = await supabase
          .from("liability_waivers")
          .update(waiverData)
          .eq("id", editingWaiverId);
        if (error) throw error;
      } else {
        const { data: insertedWaiver, error } = await supabase
          .from("liability_waivers")
          .insert(waiverData)
          .select("id, waiver_number")
          .single();
        if (error) throw error;
        waiverNumber = insertedWaiver.waiver_number;
      }

      if (!waiverNumber) {
        throw new Error("Failed to get waiver number");
      }

      refetchWaivers();

      // Build signing link and replace placeholder in email body
      const signingLink = `${window.location.origin}/waiver/${waiverNumber}`;
      const finalEmailBody = emailBody.replace(/\[Signing link will be inserted here\]/g, signingLink);

      const mailtoLink = `mailto:${selectedJob.client_email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(finalEmailBody)}`;

      window.location.href = mailtoLink;

      toast.success("Email client opened with signing link!");
      resetForm();
    } catch (error: any) {
      console.error("Error saving waiver:", error);
      toast.error(error.message || "Failed to save waiver");
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteWaiver = async () => {
    if (!editingWaiverId) {
      toast.error("No waiver selected");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!authorized) {
      toast.error("Customer must authorize the waiver");
      return;
    }

    setIsSending(true);

    try {
      // Get the waiver details
      const waiver = waivers.find((w) => w.id === editingWaiverId);
      if (!waiver) throw new Error("Waiver not found");

      // Update waiver to completed
      const { error: updateError } = await supabase
        .from("liability_waivers")
        .update({
          status: "completed",
          customer_name: customerName.trim(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", editingWaiverId);
      if (updateError) throw updateError;

      // Update job to mark waiver as signed
      if (waiver.job_id) {
        await supabase
          .from("jobs")
          .update({
            needs_liability_waiver: false,
            waiver_signed: true,
          })
          .eq("id", waiver.job_id);
      }

      // Build confirmation email for client via mailto
      const watchDetails = [waiver.watch_brand, waiver.watch_model].filter(Boolean).join(" ") || "Your Watch";
      const areas = [];
      if (waiver.dial_defects) areas.push("Dial Defects");
      if (waiver.hand_defects) areas.push("Hand Defects");
      if (waiver.additional_components) areas.push(waiver.additional_components);
      const areasOfConcern = areas.join(", ");

      const confirmationSubject = `Waiver Confirmation - ${watchDetails}`;
      const confirmationBody = `Dear ${customerName.trim()},

Thank you for signing the Release of Liability Waiver for your ${watchDetails}.

WAIVER DETAILS
Watch: ${watchDetails}${waiver.reference_number ? `\nRef #: ${waiver.reference_number}` : ""}${waiver.serial_number ? `\nRef #: ${waiver.serial_number}` : ""}
${areasOfConcern ? `Areas of Concern: ${areasOfConcern}` : ""}

Your waiver has been received and we will now proceed with the service work.

If you have any questions, please don't hesitate to contact us.

Best,
Ivy P.

Rolliworks
14 N.E. 1st Ave Ste 403
Miami FL 33132
408-800-3244
M-F 9am to 5pm | Sat-Sun: Closed
`;

      if (waiver.customer_email) {
        const mailtoLink = `mailto:${waiver.customer_email}?subject=${encodeURIComponent(confirmationSubject)}&body=${encodeURIComponent(confirmationBody)}`;
        window.location.href = mailtoLink;
      }

      toast.success("Waiver completed! Email client opened.");
      refetchWaivers();
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      resetForm();
    } catch (error: any) {
      console.error("Error completing waiver:", error);
      toast.error(error.message || "Failed to complete waiver");
    } finally {
      setIsSending(false);
    }
  };

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
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold">Liability Waiver</h1>
            <p className="text-xs text-muted-foreground">Create and send repair liability waivers</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/waiver-history">
            <History className="mr-1 h-3 w-3" />
            History
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {editingWaiverId ? "Edit Waiver Draft" : "REPAIR LIABILITY WAIVER"}
          </CardTitle>
          <CardDescription className="text-xs">
            For watches with pre-existing damage requiring customer acknowledgment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Date Field */}
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal h-8 text-sm",
                    !waiverDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {waiverDate ? format(waiverDate, "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={waiverDate}
                  onSelect={(date) => date && setWaiverDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Job/Watch Selection with Search */}
          <div className="space-y-1">
            <Label className="text-xs">Select Customer & Watch</Label>
            <Input
              placeholder="Search by client name, email, or reference #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-1 h-8 text-sm"
            />
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={isLoadingJobs ? "Loading..." : "Select a job from work queue"} />
              </SelectTrigger>
              <SelectContent>
                {filteredJobs.length === 0 ? (
                  <div className="py-1.5 px-2 text-xs text-muted-foreground">No jobs found</div>
                ) : (
                  filteredJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id} className="text-sm">
                      {getJobDisplayLabel(job)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Watch Details Display */}
          {selectedJob && (
            <div className="rounded-md border bg-muted/50 p-2 space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">Watch Details</h4>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Brand/Model: </span>
                  <span className="font-medium">
                    {[selectedJob.watch_brand, selectedJob.watch_model].filter(Boolean).join(" ") || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ref #: </span>
                  <span className="font-medium">{selectedJob.serial_number || "N/A"}</span>
                </div>
                {selectedJob.inspection?.watch?.estimate_number && (
                  <div>
                    <span className="text-muted-foreground">Estimate #: </span>
                    <span className="font-medium">{selectedJob.inspection.watch.estimate_number}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium">{selectedJob.client_email || "N/A"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Areas of Concern */}
          <div className="space-y-2">
            <Label className="text-xs">Area/Item of Concern</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dial-defects"
                  checked={dialDefects}
                  onCheckedChange={(checked) => setDialDefects(checked === true)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="dial-defects" className="text-sm font-normal cursor-pointer">
                  Dial Defects
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hand-defects"
                  checked={handDefects}
                  onCheckedChange={(checked) => setHandDefects(checked === true)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="hand-defects" className="text-sm font-normal cursor-pointer">
                  Hand Defects
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="additional-components" className="text-xs">Additional Components</Label>
              <Input
                id="additional-components"
                placeholder="e.g., Bezel insert, Crystal, Crown..."
                value={additionalComponents}
                onChange={(e) => setAdditionalComponents(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-1">
            <Label htmlFor="additional-info" className="text-xs">Additional Information</Label>
            <Textarea
              id="additional-info"
              placeholder="Describe the pre-existing condition in detail..."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Email Preview & Editor */}
          {selectedJob && (
            <Card className="border border-primary/20">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Email Preview</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Review and edit the email before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {/* Subject Line */}
                <div className="space-y-1">
                  <Label htmlFor="email-subject" className="text-xs">Subject</Label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="h-8 text-sm font-medium"
                  />
                </div>

                {/* Email Body */}
                <div className="space-y-1">
                  <Label htmlFor="email-body" className="text-xs">Email Body</Label>
                  <ScrollArea className="h-[280px] rounded-md border">
                    <Textarea
                      id="email-body"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="min-h-[260px] border-0 focus-visible:ring-0 resize-none font-mono text-xs"
                    />
                  </ScrollArea>
                </div>

                {/* Reset to template button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailBody(buildDefaultEmailBody);
                    setEmailSubject(buildDefaultEmailSubject);
                  }}
                  className="text-xs h-7"
                >
                  Reset to Template
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Customer Name and Authorization - Only shown when editing to mark complete */}
          {editingWaiverId && (
            <>
              <div className="space-y-1">
                <Label htmlFor="customer-name" className="text-xs">
                  Customer Name <span className="text-muted-foreground">(for manual completion)</span>
                </Label>
                <Input
                  id="customer-name"
                  placeholder="Enter customer's full name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="border-amber-300 focus:border-amber-500 h-8 text-sm"
                />
              </div>

              <div className="flex items-start space-x-2 rounded-md border border-amber-300 p-2 bg-amber-50/30 dark:bg-amber-950/20">
                <Checkbox
                  id="authorization"
                  checked={authorized}
                  onCheckedChange={(checked) => setAuthorized(checked === true)}
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <Label htmlFor="authorization" className="text-sm font-medium cursor-pointer leading-tight">
                  Customer has authorized Rolliworks to proceed
                </Label>
              </div>
            </>
          )}
          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSending || !selectedJobId}
              className="flex-1"
            >
              <FileText className="mr-1 h-3 w-3" />
              Save Draft
            </Button>
            <Button
              onClick={handleSendWaiverEmail}
              disabled={!selectedJobId || !selectedJob?.client_email}
              className="flex-1"
              size="sm"
            >
              <Send className="mr-1 h-3 w-3" />
              Send Waiver
            </Button>
          </div>

          {/* Complete Waiver Button - Only shown when editing pending waiver */}
          {editingWaiverId && (
            <Button
              onClick={handleCompleteWaiver}
              disabled={isSending || !customerName.trim() || !authorized}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="sm"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Complete Waiver
                </>
              )}
            </Button>
          )}

          {editingWaiverId && (
            <Button variant="ghost" size="sm" onClick={resetForm} className="w-full">
              Cancel Editing
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            A copy will be sent to help@rolliworks.com and to the customer's email on file.
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWaiverId} onOpenChange={() => setDeleteWaiverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Waiver?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the waiver draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWaiver}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
