import * as React from "react";
import { Plus, X, DollarSign, Package, Check, Mail, ThumbsUp, ThumbsDown, ShoppingCart, PackageCheck, Printer, Save, ChevronDown, Search, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserPermissions, hasPermission } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export interface PartRequest {
  id: string;
  name?: string;
  description?: string;
  quantity?: number;
  qty?: number;
  requested_by?: string;
  requested_at: string;
  price: number | null;
  priced_by?: string;
  priced_at?: string;
  status?: string;
  added_to_template?: boolean;
  email_sent?: boolean;
}

interface PartsRequestSectionProps {
  partsRequests: PartRequest[];
  onChange: (parts: PartRequest[]) => void;
  readOnly?: boolean;
  jobId?: string;
  clientEmail?: string;
  clientName?: string;
  watchBrand?: string;
  watchModel?: string;
  estimateNumber?: string;
  referenceNumber?: string;
  onEmailSent?: (updatedParts: PartRequest[]) => void;
  onApprovalStatusChange?: (
    status: "approved" | "declined" | "pending",
    updatedParts: PartRequest[]
  ) => void;
   onPartsApprovedByClient?: (approvedParts: PartRequest[]) => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function PartsRequestSection({
  partsRequests,
  onChange,
  readOnly = false,
  jobId,
  clientEmail,
  clientName,
  watchBrand,
  watchModel,
  estimateNumber,
  referenceNumber,
  onEmailSent,
  onApprovalStatusChange,
   onPartsApprovedByClient,
  onCancel,
  onPrint,
  onSave,
  isSaving = false,
}: PartsRequestSectionProps) {
  const { data: userPermissions } = useUserPermissions();
  const { data: emailTemplates } = useEmailTemplates();
  const [newPartName, setNewPartName] = React.useState("");
  const [newPartQty, setNewPartQty] = React.useState(1);
  const [newPartPrice, setNewPartPrice] = React.useState("");
  const [manualApprovalMode, setManualApprovalMode] = React.useState(false);
  const [lookingUpPrice, setLookingUpPrice] = React.useState<string | null>(null);
  
  // Email preview dialog state
  const [emailPreviewOpen, setEmailPreviewOpen] = React.useState(false);
  const [emailPreviewSubject, setEmailPreviewSubject] = React.useState("");
  const [emailPreviewBody, setEmailPreviewBody] = React.useState("");
  const [approvalUrl, setApprovalUrl] = React.useState("");
  const [creatingApproval, setCreatingApproval] = React.useState(false);

  // Lookup price from RolliSuite
  const handlePriceLookup = async (partId: string, partName: string) => {
    if (!partName) return;
    
    setLookingUpPrice(partId);
    try {
      const { data, error } = await supabase.functions.invoke('rollisuite-price-lookup', {
        body: { search: partName }
      });
      
      if (error) {
        console.error('Price lookup error:', error);
        toast.error('Failed to lookup price');
        return;
      }
      
      if (data?.success && data?.results?.length > 0) {
        const result = data.results[0];
        if (result.price !== undefined && result.price !== null) {
          // Update the part with the found price
          onChange(
            partsRequests.map((p) =>
              p.id === partId
                ? {
                    ...p,
                    price: result.price,
                    priced_at: new Date().toISOString(),
                  }
                : p
            )
          );
          toast.success(`Found price: $${result.price.toFixed(2)}`);
        } else {
          toast.info('Part found but no price available');
        }
      } else {
        toast.info('No matching part found in RolliSuite');
      }
    } catch (err) {
      console.error('Price lookup error:', err);
      toast.error('Failed to lookup price');
    } finally {
      setLookingUpPrice(null);
    }
  };
  // Filter parts approval templates
  const partsApprovalTemplates = React.useMemo(() => {
    return emailTemplates?.filter((t) => t.type === "parts_approval" && t.is_active) || [];
  }, [emailTemplates]);

  const canAdd = hasPermission(userPermissions, "parts.create");
  const canPrice = hasPermission(userPermissions, "parts.set_price");

  const handleAddPart = () => {
    if (!newPartName.trim()) return;

    const parsedPrice = newPartPrice ? parseFloat(newPartPrice) : null;
    const validPrice = parsedPrice !== null && !isNaN(parsedPrice) ? parsedPrice : null;

    const newPart: PartRequest = {
      id: crypto.randomUUID(),
      name: newPartName.trim(),
      description: newPartName.trim(),
      quantity: newPartQty,
      qty: newPartQty,
      requested_at: new Date().toISOString(),
      price: manualApprovalMode ? validPrice : null,
      priced_at: manualApprovalMode && validPrice !== null ? new Date().toISOString() : undefined,
      status: "pending",
      added_to_template: manualApprovalMode,
      email_sent: manualApprovalMode,
    };

    onChange([...partsRequests, newPart]);
    setNewPartName("");
    setNewPartQty(1);
    setNewPartPrice("");
  };

  const getPartName = (part: PartRequest): string => {
    return part.name || part.description || "Unknown Part";
  };

  const getPartQty = (part: PartRequest): number => {
    return part.quantity ?? part.qty ?? 1;
  };

  const handleRemovePart = (id: string) => {
    if (!canPrice) return;
    onChange(partsRequests.filter((p) => p.id !== id));
  };

  const handlePriceChange = (id: string, priceValue: string) => {
    if (!canPrice) return;
    const price = priceValue === "" ? null : parseFloat(priceValue);
    onChange(
      partsRequests.map((p) =>
        p.id === id
          ? {
              ...p,
              price: isNaN(price as number) ? null : price,
              priced_at: price !== null ? new Date().toISOString() : undefined,
            }
          : p
      )
    );
  };

  const handleAddToTemplate = (id: string) => {
    onChange(
      partsRequests.map((p) =>
        p.id === id ? { ...p, added_to_template: true } : p
      )
    );
  };

  const handleRemoveFromTemplate = (id: string) => {
    onChange(
      partsRequests.map((p) =>
        p.id === id ? { ...p, added_to_template: false } : p
      )
    );
  };

  const handleApprove = async (id: string) => {
    const part = partsRequests.find((p) => p.id === id);
    const updatedParts = partsRequests.map((p) =>
      p.id === id ? { ...p, status: "approved" } : p
    );
    onChange(updatedParts);
    
    // Send allocation to RolliSuite
    if (part && estimateNumber) {
      try {
        const { data, error } = await supabase.functions.invoke('rollisuite-part-allocation', {
          body: {
            part_name: part.name || part.description,
            quantity: part.quantity || part.qty || 1,
            estimate_number: estimateNumber,
            customer_name: clientName,
            watch_brand: watchBrand,
            watch_model: watchModel,
            status: 'allocated',
          }
        });
        
        if (error) {
          console.error('Failed to send allocation to RolliSuite:', error);
        } else if (data?.success) {
          console.log('Part allocation sent to RolliSuite:', data);
        }
      } catch (err) {
        console.error('Error sending allocation to RolliSuite:', err);
      }
    }
    
    // Check if all template parts are now approved
    const templatePartsAfter = updatedParts.filter((p) => p.added_to_template);
    const allApproved = templatePartsAfter.every((p) => p.status === "approved");
    const allAnswered = templatePartsAfter.every((p) => p.status === "approved" || p.status === "declined");
    if (allApproved && templatePartsAfter.length > 0) {
      onApprovalStatusChange?.("approved", updatedParts);
    } else if (allAnswered && templatePartsAfter.some((p) => p.status === "declined")) {
      onApprovalStatusChange?.("approved", updatedParts);
    }

    // Notify RolliSuite when client has responded to all parts
    if (allAnswered && templatePartsAfter.length > 0 && estimateNumber) {
         try {
           const { data: webhookData, error: webhookError } = await supabase.functions.invoke(
             'rollisuite-parts-approved',
             {
               body: {
                 estimateNumber,
                  parts: templatePartsAfter.map((p) => ({
                    name: p.name || p.description,
                    description: p.name || p.description,
                    price: p.price ?? 0,
                    qty: p.qty || 1,
                    status: p.status,
                  })),
                 approvedBy: clientName?.split(' ')[0],
               },
             }
           );
           
           if (webhookError) {
             console.error('Failed to notify RolliSuite of parts approval:', webhookError);
           } else if (webhookData?.success) {
             console.log('RolliSuite notified of parts approval:', webhookData);
           }
          } catch (err) {
            console.error('Error notifying RolliSuite of parts approval:', err);
          }
        }

        onPartsApprovedByClient?.(templatePartsAfter);
    toast.success("Part approved");
  };

  const handleDecline = (id: string) => {
    const updatedParts = partsRequests.map((p) =>
      p.id === id ? { ...p, status: "declined", added_to_template: false } : p
    );
    onChange(updatedParts);
    
    // Check remaining template parts
    const templatePartsAfter = updatedParts.filter((p) => p.added_to_template);
    const allDeclined = templatePartsAfter.length === 0;
    if (allDeclined) {
      onApprovalStatusChange?.("declined", updatedParts);
    }
    toast.success("Part declined");
  };

  const handleMarkOnOrder = (id: string) => {
    const updatedParts = partsRequests.map((p) =>
      p.id === id ? { ...p, status: "on_order" } : p
    );
    onChange(updatedParts);
    
    // Update aggregate status - if any approved part is now on_order, update job status
    const hasOnOrder = updatedParts.some((p) => p.status === "on_order");
    if (hasOnOrder) {
      onApprovalStatusChange?.("pending", updatedParts); // Will be handled as "on_order" in parent
    }
    toast.success("Part marked as on order");
  };

  const handleMarkReceived = (id: string) => {
    const updatedParts = partsRequests.map((p) =>
      p.id === id ? { ...p, status: "received" } : p
    );
    onChange(updatedParts);
    
    // Check if all on_order parts are now received - if so, update to approved
    const stillOnOrder = updatedParts.some((p) => p.status === "on_order");
    if (!stillOnOrder) {
      // All parts received, can proceed with job
      onApprovalStatusChange?.("approved", updatedParts);
    } else {
      onApprovalStatusChange?.("pending", updatedParts);
    }
    toast.success("Part marked as received");
  };

  const templateParts = partsRequests.filter((p) => p.added_to_template);
  // Parts in template that haven't been emailed yet
  const unsentTemplateParts = templateParts.filter((p) => !p.email_sent);
  // Parts in template that have been emailed (awaiting response)
  const sentTemplateParts = templateParts.filter((p) => p.email_sent && p.status !== 'approved' && p.status !== 'declined' && p.status !== 'on_order' && p.status !== 'received');
  // Parts that have been responded to (approved, on_order, received, or declined)
  const respondedParts = templateParts.filter((p) => p.status === 'approved' || p.status === 'on_order' || p.status === 'received' || p.status === 'declined');
  
  // Active parts for the main list - only show parts that haven't completed the approval flow
  // Exclude: approved, on_order, received, declined (all completed states)
  const activeParts = partsRequests.filter((p) => 
    p.status !== 'approved' && 
    p.status !== 'on_order' && 
    p.status !== 'received' && 
    p.status !== 'declined'
  );
  
  const totalPrice = activeParts.reduce((sum, p) => {
    if (p.price !== null) {
      return sum + p.price * getPartQty(p);
    }
    return sum;
  }, 0);
  const templateTotal = templateParts.reduce((sum, p) => {
    if (p.price !== null) {
      return sum + p.price * getPartQty(p);
    }
    return sum;
  }, 0);
  const unsentTotal = unsentTemplateParts.reduce((sum, p) => {
    if (p.price !== null) {
      return sum + p.price * getPartQty(p);
    }
    return sum;
  }, 0);
  const pendingPricing = activeParts.filter((p) => p.price === null).length;

  // Check if we have priced parts that can be emailed
  const hasPricedParts = activeParts.some((p) => p.price !== null);

  // Handle sending email with a specific template
  const handleSendEmailWithTemplate = async (templateId: string) => {
    try {
      const template = partsApprovalTemplates.find((t) => t.id === templateId);
      if (!template) {
        toast.error("Template not found");
        return;
      }

      // Get priced parts that are not already added to template
      const partsToEmail = activeParts.filter((p) => p.price !== null);
      
      if (partsToEmail.length === 0) {
        toast.error("No priced parts to include in email");
        return;
      }

      // Build parts list for email body
      const partsList = partsToEmail
        .map(p => `• ${getPartName(p)} (Qty: ${getPartQty(p)}) - $${((p.price || 0) * getPartQty(p)).toFixed(2)}`)
        .join('\n');
      
      const partsTotal = partsToEmail.reduce((sum, p) => sum + (p.price || 0) * getPartQty(p), 0);

      // Get first name from full name
      const firstName = clientName?.split(' ')[0] || 'Valued Customer';

      // Process template placeholders
      const refNumberValue = referenceNumber || "";

      let emailBody = template.body
        .replace(/\{\{customer_first_name\}\}/g, firstName)
        .replace(/\{\{client_name\}\}/g, clientName || "")
        .replace(/\{\{watch_brand\}\}/g, watchBrand || "")
        .replace(/\{\{watch_model\}\}/g, watchModel || "")
        .replace(/\{\{estimate_number\}\}/g, estimateNumber || "")
        .replace(/\{\{\s*Ref_number\s*\}\}/gi, refNumberValue)
        .replace(/\{\{\s*serial_number\s*\}\}/gi, refNumberValue)
        // Backward compatible placeholders
        .replace(/\{\{\s*Estimate No\.?\s*\}\}/gi, estimateNumber || "")
        .replace(/\[\s*Estimate No\.?\s*\]/gi, estimateNumber || "");

      // Insert parts list - look for common insertion points
      const partsSection = `\n\nPARTS REQUESTED:\n${partsList}`;
      
      // Try to find "end of life" phrase and insert parts after it
      const endOfLifePattern = /at end of life[:\s]*/i;
      const approvalPattern = /seek(?:ing)? approval for the following part\(?s?\)?[:\s]*/i;
      const reviewPattern = /Please review/i;
      
      if (endOfLifePattern.test(emailBody)) {
        // Insert parts list after "at end of life:" phrase
        emailBody = emailBody.replace(endOfLifePattern, (match) => `${match}${partsSection}\n\n`);
      } else if (approvalPattern.test(emailBody)) {
        // Insert after "seek approval for the following part(s):" phrase
        emailBody = emailBody.replace(approvalPattern, (match) => `${match}${partsSection}\n\n`);
      } else if (reviewPattern.test(emailBody)) {
        // Insert before "Please review"
        emailBody = emailBody.replace(reviewPattern, `${partsSection}\n\nPlease review`);
      } else {
        // Fallback: append at the end
        emailBody = emailBody + partsSection;
      }

      let emailSubject = template.subject
        .replace(/\{\{estimate_number\}\}/g, estimateNumber || "")
        .replace(/\{\{watch_brand\}\}/g, watchBrand || "")
        .replace(/\{\{watch_model\}\}/g, watchModel || "")
        .replace(/\{\{\s*Ref_number\s*\}\}/gi, refNumberValue)
        .replace(/\{\{\s*serial_number\s*\}\}/gi, refNumberValue)
        // Backward compatible placeholders
        .replace(/\{\{\s*Estimate No\.?\s*\}\}/gi, estimateNumber || "")
        .replace(/\[\s*Estimate No\.?\s*\]/gi, estimateNumber || "");

      // Open mail client
      const mailtoLink = `mailto:${clientEmail || ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoLink, '_blank');
      
      // Mark these parts as added to template and email_sent
      const updatedParts = partsRequests.map((p) => {
        if (p.price !== null && p.status !== 'approved' && p.status !== 'on_order' && p.status !== 'received' && p.status !== 'declined') {
          return { ...p, added_to_template: true, email_sent: true };
        }
        return p;
      });
      onChange(updatedParts);
      onEmailSent?.(updatedParts);
      toast.success("Email client opened");
    } catch (err) {
      console.error('Error loading email template:', err);
      toast.error("Failed to load email template");
    }
  };

  // New: Create parts_approval record, show editable email preview, then send via mailto with URL
  const handleSendUrlWithTemplate = async (templateId: string) => {
    if (!jobId) {
      toast.error("Please save the job first before sending approval URL");
      return;
    }

    setCreatingApproval(true);
    try {
      const template = partsApprovalTemplates.find((t) => t.id === templateId);
      if (!template) { toast.error("Template not found"); return; }

      // Include both unsent AND sent-but-awaiting template parts
      const partsToEmail = templateParts.filter((p) => p.price !== null && p.status !== 'approved' && p.status !== 'declined' && p.status !== 'on_order' && p.status !== 'received');
      if (partsToEmail.length === 0) { toast.error("No priced parts to send"); return; }

      // 1. Create parts_approvals record
      const partsItemsPayload = partsToEmail.map((p) => ({
        id: p.id,
        name: getPartName(p),
        qty: getPartQty(p),
        price: p.price || 0,
        choice: null,
      }));

      const { data: approvalRecord, error: insertError } = await supabase
        .from("parts_approvals")
        .insert({
          job_id: jobId,
          parts_items: partsItemsPayload,
          client_name: clientName || null,
          client_email: clientEmail || null,
          status: "pending",
        })
        .select()
        .single();

      if (insertError || !approvalRecord) {
        console.error("Failed to create parts approval:", insertError);
        toast.error("Failed to create approval record");
        return;
      }

      // 2. Build approval URL - use production domain
      const baseUrl = "https://app.rolliworks.com";
      const url = `${baseUrl}/approve-parts?id=${approvalRecord.id}`;
      setApprovalUrl(url);

      // 3. Process template with placeholders
      const firstName = clientName?.split(" ")[0] || "Valued Customer";
      const refNumberValue = referenceNumber || "";

      const partsList = partsToEmail
        .map((p) => `• ${getPartName(p)} (Qty: ${getPartQty(p)}) - $${((p.price || 0) * getPartQty(p)).toFixed(2)}`)
        .join("\n");

      let emailBody = template.body
        .replace(/\{\{customer_first_name\}\}/g, firstName)
        .replace(/\{\{client_name\}\}/g, clientName || "")
        .replace(/\{\{watch_brand\}\}/g, watchBrand || "")
        .replace(/\{\{watch_model\}\}/g, watchModel || "")
        .replace(/\{\{brand\}\}/g, watchBrand || "")
        .replace(/\{\{model\}\}/g, watchModel || "")
        .replace(/\{\{estimate_number\}\}/g, estimateNumber || "")
        .replace(/\{\{\s*Ref_number\s*\}\}/gi, refNumberValue)
        .replace(/\{\{\s*serial_number\s*\}\}/gi, refNumberValue);

      // Insert URL right after the greeting line, then the rest of the template body, then parts list
      const greetingMatch = emailBody.match(/^(Dear\s+[^,\n]+,?\s*\n?)/i);
      if (greetingMatch) {
        const greeting = greetingMatch[1];
        const restOfBody = emailBody.slice(greeting.length);
        emailBody = `${greeting}\nPlease click the link below to approve or decline each part:\n${url}\n${restOfBody}`;
      } else {
        emailBody = `Please click the link below to approve or decline each part:\n${url}\n\n${emailBody}`;
      }

      emailBody += `\n\nPARTS REQUESTED:\n${partsList}\n\nTotal: $${partsToEmail.reduce((s, p) => s + (p.price || 0) * getPartQty(p), 0).toFixed(2)}`;
      emailBody += `\n\nWe will be awaiting your reply before proceeding.`;

      let emailSubject = template.subject
        .replace(/\{\{estimate_number\}\}/g, estimateNumber || "")
        .replace(/\{\{watch_brand\}\}/g, watchBrand || "")
        .replace(/\{\{watch_model\}\}/g, watchModel || "")
        .replace(/\{\{brand\}\}/g, watchBrand || "")
        .replace(/\{\{model\}\}/g, watchModel || "");

      // 4. Show editable preview dialog
      setEmailPreviewSubject(emailSubject);
      setEmailPreviewBody(emailBody);
      setEmailPreviewOpen(true);
    } catch (err) {
      console.error("Error creating parts approval:", err);
      toast.error("Failed to create approval");
    } finally {
      setCreatingApproval(false);
    }
  };

  return (
    <>
    <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-green-600" />
          Parts Requests
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Request parts for this job. Manager/Owner can set pricing.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new part request */}
        {canAdd && !readOnly && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  placeholder="Part name (e.g., Crown, Crystal)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPart();
                    }
                  }}
                />
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  value={newPartQty}
                  onChange={(e) => setNewPartQty(parseInt(e.target.value) || 1)}
                  placeholder="Qty"
                />
              </div>
              {manualApprovalMode && (
                <div className="w-24 relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newPartPrice}
                    onChange={(e) => setNewPartPrice(e.target.value)}
                    placeholder="Price"
                    className="pl-7"
                  />
                </div>
              )}
              <Button type="button" variant="outline" onClick={handleAddPart}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {/* Manual approval toggle */}
            {canPrice && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualApprovalMode}
                  onChange={(e) => setManualApprovalMode(e.target.checked)}
                  className="rounded border-muted-foreground"
                />
                <span className="text-muted-foreground">
                  Already sent for approval
                </span>
                {manualApprovalMode && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    Skips email — adds directly to Awaiting Response
                  </Badge>
                )}
              </label>
            )}
          </div>
        )}

        {/* List of active parts requests - excludes declined and received */}
        {activeParts.length > 0 ? (
          <div className="space-y-3">
            {activeParts.map((part) => (
              <div
                key={part.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
              >
                {/* Part details and actions */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-base">{getPartName(part)}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Qty: {getPartQty(part)}
                  </p>
                  
                  {/* Add/Remove from template buttons */}
                  {canPrice && !readOnly && (
                    <div className="flex items-center gap-2">
                      {!part.added_to_template ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleAddToTemplate(part.id)}
                          disabled={part.price === null}
                          title={part.price === null ? "Set price first" : "Add to approval template"}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleRemoveFromTemplate(part.id)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Price input, lookup, and delete */}
                <div className="flex flex-col gap-2 items-end">
                  <div className="space-y-1">
                    {canPrice && (
                      <Label className="text-xs text-muted-foreground">Unit Price</Label>
                    )}
                    <div className="flex items-center gap-1">
                      <div className="relative w-24">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={part.price ?? ""}
                          onChange={(e) => handlePriceChange(part.id, e.target.value)}
                          placeholder="0.00"
                          className="pl-7 h-9"
                          disabled={!canPrice || readOnly}
                        />
                      </div>
                      {/* RolliSuite Price Lookup Button */}
                      {canPrice && !readOnly && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => handlePriceLookup(part.id, getPartName(part))}
                          disabled={lookingUpPrice === part.id}
                          title="Lookup price from RolliSuite"
                        >
                          {lookingUpPrice === part.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Delete part button */}
                  {canPrice && !readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemovePart(part.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                {pendingPricing > 0 && (
                  <span className="text-amber-600 font-medium">
                    {pendingPricing} part{pendingPricing !== 1 ? "s" : ""} pending pricing
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">
                Total: ${totalPrice.toFixed(2)}
              </div>
            </div>

            {/* Action Buttons - show when parts exist and some are priced */}
            {hasPricedParts && !readOnly && (
              <div className="flex flex-wrap gap-2 pt-3 border-t mt-3">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                )}
                {onPrint && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onPrint}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {partsApprovalTemplates.length > 0 ? (
                      partsApprovalTemplates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleSendEmailWithTemplate(template.id)}
                        >
                          {template.name}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        No parts approval templates found
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {onSave && (
                  <Button
                    type="button"
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={onSave}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No parts requested yet
          </p>
        )}

        {/* Parts for Approval Email - NEW parts not yet emailed */}
        {unsentTemplateParts.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border-2 border-green-400 bg-green-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <h4 className="font-medium text-green-800">
                  Parts for Approval Email
                </h4>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {unsentTemplateParts.length} part{unsentTemplateParts.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-2 mb-4">
              {unsentTemplateParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between text-sm bg-white/60 p-2 rounded gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-medium">
                      {getPartName(part)} × {getPartQty(part)}
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">
                    ${((part.price || 0) * getPartQty(part)).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-green-300 flex justify-between font-semibold">
                <span className="text-green-800">Total:</span>
                <span className="text-green-800">${unsentTotal.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Send URL Button - opens email preview */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={creatingApproval || !jobId}
                >
                  {creatingApproval ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send URL for Parts Approval
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {partsApprovalTemplates.length > 0 ? (
                  partsApprovalTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleSendUrlWithTemplate(template.id)}
                    >
                      {template.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    No parts approval templates found
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Email Preview Dialog */}
        <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit & Send Parts Approval Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Subject</label>
                <input
                  value={emailPreviewSubject}
                  onChange={(e) => setEmailPreviewSubject(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Email Body</label>
                <textarea
                  value={emailPreviewBody}
                  onChange={(e) => setEmailPreviewBody(e.target.value)}
                  className="w-full min-h-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed"
                />
              </div>
              {approvalUrl && (
                <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1">Approval URL (included in body):</p>
                  <p className="text-xs text-blue-600 break-all">{approvalUrl}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEmailPreviewOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    // Open mailto with edited content
                    const mailtoLink = `mailto:${clientEmail || ''}?subject=${encodeURIComponent(emailPreviewSubject)}&body=${encodeURIComponent(emailPreviewBody)}`;
                    window.open(mailtoLink, '_blank');
                    
                    // Mark all priced, active parts as email_sent
                    const updatedParts = partsRequests.map((p) =>
                      p.price !== null && !['approved', 'declined', 'on_order', 'received'].includes(p.status || '')
                        ? { ...p, added_to_template: true, email_sent: true }
                        : p
                    );
                    onChange(updatedParts);
                    onEmailSent?.(updatedParts);
                    setEmailPreviewOpen(false);
                    toast.success("Email client opened with approval URL");
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Open in Mail Client
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Awaiting Client Response - parts that have been emailed but not yet responded */}
        {sentTemplateParts.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border-2 border-blue-400 bg-blue-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-blue-800">
                  Awaiting Client Response
                </h4>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {sentTemplateParts.length} part{sentTemplateParts.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-2">
              {sentTemplateParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between text-sm bg-white/60 p-2 rounded gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-medium">
                      {getPartName(part)} × {getPartQty(part)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      ${((part.price || 0) * getPartQty(part)).toFixed(2)}
                    </span>
                    {canPrice && !readOnly && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleApprove(part.id)}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Approved
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleDecline(part.id)}
                        >
                          <ThumbsDown className="h-3 w-3 mr-1" />
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resend URL Button for awaiting parts */}
            {canPrice && !readOnly && (
              <div className="mt-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                      disabled={creatingApproval || !jobId}
                    >
                      {creatingApproval ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send URL for Parts Approval
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {partsApprovalTemplates.length > 0 ? (
                      partsApprovalTemplates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleSendUrlWithTemplate(template.id)}
                        >
                          {template.name}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        No parts approval templates found
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}

        {/* Responded Parts - parts that have been approved, on_order, or declined */}
        {respondedParts.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border-2 border-muted bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-muted-foreground">
                  Client Responses
                </h4>
              </div>
              <Badge variant="secondary">
                {respondedParts.length} part{respondedParts.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-2">
              {respondedParts.map((part) => (
                <div key={part.id} className="flex items-center justify-between text-sm bg-white/60 p-2 rounded gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-medium">
                      {getPartName(part)} × {getPartQty(part)}
                    </span>
                    {part.status === 'approved' && (
                      <Badge className="ml-2 bg-green-500 text-white text-xs">Approved</Badge>
                    )}
                    {part.status === 'on_order' && (
                      <Badge className="ml-2 bg-purple-500 text-white text-xs">On Order</Badge>
                    )}
                    {part.status === 'received' && (
                      <Badge className="ml-2 bg-emerald-600 text-white text-xs">Received</Badge>
                    )}
                    {part.status === 'declined' && (
                      <Badge className="ml-2 bg-red-500 text-white text-xs">Declined</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      ${((part.price || 0) * getPartQty(part)).toFixed(2)}
                    </span>
                    {/* Show Order button for approved parts */}
                    {part.status === 'approved' && canPrice && !readOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                        onClick={() => handleMarkOnOrder(part.id)}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Order
                      </Button>
                    )}
                    {/* Show Received button for on_order parts */}
                    {part.status === 'on_order' && canPrice && !readOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleMarkReceived(part.id)}
                      >
                        <PackageCheck className="h-3 w-3 mr-1" />
                        Received
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
