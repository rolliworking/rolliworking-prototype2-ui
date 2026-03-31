import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLatestMeaningfulApprovalsByInspection } from "@/lib/inspection-approval-utils";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface PendingApproval {
  id: string;
  inspection_id: string;
  created_at: string;
  client_name: string | null;
  client_email: string | null;
  // enriched from inspection → watch → customer
  customer_name: string;
  customer_email: string | null;
  estimate_number: string;
  brand: string;
  model: string | null;
  reference_number: string | null;
  inspection_type: string;
  days_pending: number;
}

type AgePartition = "30+" | "15-29" | "0-14";

interface NoReplyInboxProps {
  searchTerm: string;
  onCountChange?: (count: number) => void;
}

export function NoReplyInbox({ searchTerm, onCountChange }: NoReplyInboxProps) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, string>>({});
  const [expandedPartitions, setExpandedPartitions] = useState<Record<AgePartition, boolean>>({
    "30+": true,
    "15-29": true,
    "0-14": true,
  });

  const { data: roleData } = useUserRole();
  const canDelete = roleData === "owner" || roleData === "manager";

  const { data: emailTemplates } = useEmailTemplates();
  const activeTemplates = useMemo(
    () => (emailTemplates || []).filter((t) => t.is_active && t.type === "follow_up"),
    [emailTemplates]
  );

  const handleDelete = useCallback(async (approvalId: string) => {
    const { error } = await supabase
      .from("inspection_approvals")
      .delete()
      .eq("id", approvalId);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    setPending((prev) => {
      const updated = prev.filter((p) => p.id !== approvalId);
      onCountChange?.(updated.length);
      return updated;
    });
    toast.success("Entry deleted");
  }, [onCountChange]);

  const fetchPending = useCallback(async () => {
    setLoading(true);

    const { data: allApprovals, error } = await supabase
      .from("inspection_approvals")
      .select("id, inspection_id, created_at, client_name, client_email, status, approved_at")
      .order("created_at", { ascending: true });

    if (error || !allApprovals || allApprovals.length === 0) {
      setPending([]);
      setLoading(false);
      onCountChange?.(0);
      return;
    }

    const latestByInspection = getLatestMeaningfulApprovalsByInspection(allApprovals);
    const approvals = Array.from(latestByInspection.values())
      .filter((approval) => approval.status === "pending")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (approvals.length === 0) {
      setPending([]);
      setLoading(false);
      onCountChange?.(0);
      return;
    }

    // Enrich with inspection → watch → customer data
    const inspectionIds = [...new Set(approvals.map((a) => a.inspection_id))];
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, inspection_type, watches(estimate_number, brand, model, reference_number, customers(name, email))")
      .in("id", inspectionIds);

    const inspMap = new Map<string, any>();
    if (inspections) {
      for (const insp of inspections) {
        inspMap.set(insp.id, insp);
      }
    }

    const now = new Date();
    const enriched: PendingApproval[] = approvals.map((a) => {
      const insp = inspMap.get(a.inspection_id);
      const watch = insp?.watches;
      const customer = watch?.customers;
      return {
        id: a.id,
        inspection_id: a.inspection_id,
        created_at: a.created_at,
        client_name: a.client_name,
        client_email: a.client_email,
        customer_name: customer?.name || a.client_name || "Unknown",
        customer_email: customer?.email || a.client_email || null,
        estimate_number: watch?.estimate_number || "",
        brand: watch?.brand || "",
        model: watch?.model || null,
        reference_number: watch?.reference_number || null,
        inspection_type: insp?.inspection_type || "",
        days_pending: differenceInDays(now, new Date(a.created_at)),
      };
    });

    setPending(enriched);
    onCountChange?.(enriched.length);
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return pending;
    const term = searchTerm.toLowerCase();
    return pending.filter(
      (p) =>
        p.customer_name.toLowerCase().includes(term) ||
        (p.customer_email || "").toLowerCase().includes(term) ||
        p.estimate_number.toLowerCase().includes(term) ||
        (p.reference_number || "").toLowerCase().includes(term)
    );
  }, [pending, searchTerm]);

  const partitions = useMemo(() => {
    const groups: Record<AgePartition, PendingApproval[]> = {
      "30+": [],
      "15-29": [],
      "0-14": [],
    };
    for (const item of filtered) {
      if (item.days_pending >= 30) groups["30+"].push(item);
      else if (item.days_pending >= 15) groups["15-29"].push(item);
      else groups["0-14"].push(item);
    }
    return groups;
  }, [filtered]);

  const togglePartition = (key: AgePartition) => {
    setExpandedPartitions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendFollowUp = (item: PendingApproval) => {
    const templateId = selectedTemplate[item.id];
    const template = activeTemplates.find((t) => t.id === templateId);
    if (!template) {
      toast.error("Select a template first");
      return;
    }

    const email = item.customer_email;
    if (!email) {
      toast.error("No email address on file for this client");
      return;
    }

    // Build mailto with template subject/body, replacing placeholders
    const firstName = item.customer_name.split(" ")[0] || item.customer_name;
    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{customer_first_name\}\}/g, firstName)
        .replace(/\{\{client_name\}\}/g, item.customer_name)
        .replace(/\{\{watch_brand\}\}/g, item.brand)
        .replace(/\{\{watch_model\}\}/g, item.model || "")
        .replace(/\{\{brand\}\}/g, item.brand)
        .replace(/\{\{model\}\}/g, item.model || "")
        .replace(/\{\{estimate_number\}\}/g, item.estimate_number)
        .replace(/\{\{\s*Ref_number\s*\}\}/gi, item.reference_number || "")
        .replace(/\{\{\s*serial_number\s*\}\}/gi, item.reference_number || "")
        .replace(/\{\{\s*Estimate No\.?\s*\}\}/gi, item.estimate_number)
        .replace(/\[\s*Estimate No\.?\s*\]/gi, item.estimate_number)
        // Legacy placeholders
        .replace(/\{name\}/gi, item.customer_name)
        .replace(/\{estimate\}/gi, item.estimate_number)
        .replace(/\{brand\}/gi, item.brand)
        .replace(/\{model\}/gi, item.model || "");

    const subject = replacePlaceholders(template.subject);
    const body = replacePlaceholders(template.body);

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
    toast.success(`Follow-up email opened for ${item.customer_name}`);
  };

  const partitionConfig: { key: AgePartition; label: string; color: string; icon: typeof AlertTriangle }[] = [
    { key: "30+", label: "30+ Days — Urgent", color: "text-destructive", icon: AlertTriangle },
    { key: "15-29", label: "15–29 Days — Follow Up", color: "text-amber-600", icon: Clock },
    { key: "0-14", label: "14 Days or Newer", color: "text-muted-foreground", icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No pending approvals without a reply.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {partitionConfig.map(({ key, label, color, icon: Icon }) => {
        const items = partitions[key];
        if (items.length === 0) return null;
        const isOpen = expandedPartitions[key];

        return (
          <Card key={key}>
            <Collapsible open={isOpen} onOpenChange={() => togglePartition(key)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className={`text-sm font-semibold ${color}`}>{label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-2">
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Link
                              to={`/inspections/new?edit=${item.inspection_id}`}
                              className="text-sm font-medium truncate max-w-[140px] text-primary hover:underline"
                            >
                              {item.customer_name}
                            </Link>
                            {item.estimate_number && (
                              <span className="text-xs font-mono text-muted-foreground shrink-0">
                                #{item.estimate_number}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              {item.brand}
                              {item.model && ` ${item.model}`}
                            </span>
                            {item.reference_number && (
                              <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
                                Ref: {item.reference_number}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              Sent {format(new Date(item.created_at), "M/d/yy")}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                item.days_pending >= 30
                                  ? "border-destructive text-destructive"
                                  : item.days_pending >= 15
                                  ? "border-amber-500 text-amber-600"
                                  : ""
                              }`}
                            >
                              {item.days_pending}d
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                              <Link to={`/inspections/new?edit=${item.inspection_id}`}>
                                <Pencil className="h-3 w-3" />
                              </Link>
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Follow-up row */}
                        <Collapsible
                          open={expandedId === item.id}
                          onOpenChange={() =>
                            setExpandedId(expandedId === item.id ? null : item.id)
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground mt-1 px-2"
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Follow Up
                              {expandedId === item.id ? (
                                <ChevronDown className="h-3 w-3 ml-1" />
                              ) : (
                                <ChevronRight className="h-3 w-3 ml-1" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="flex items-center gap-2 mt-2 pl-2">
                              <Select
                                value={selectedTemplate[item.id] || ""}
                                onValueChange={(v) =>
                                  setSelectedTemplate((prev) => ({ ...prev, [item.id]: v }))
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-[220px]">
                                  <SelectValue placeholder="Select template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeTemplates.map((t) => (
                                    <SelectItem key={t.id} value={t.id} className="text-xs">
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSendFollowUp(item)}
                                disabled={!selectedTemplate[item.id]}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Send
                              </Button>
                              {item.customer_email && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  → {item.customer_email}
                                </span>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
