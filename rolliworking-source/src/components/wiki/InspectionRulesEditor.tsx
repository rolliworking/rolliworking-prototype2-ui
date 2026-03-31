import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, X, Check, Power, PowerOff, Save, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const SECTIONS = [
  { value: "W", label: "W – Watch (Movement)" },
  { value: "B", label: "B – Bracelet" },
  { value: "P", label: "P – Polish" },
  { value: "PM", label: "PM – Precious Metal" },
  { value: "SJ", label: "SJ – Small Job" },
];

const ACTIONS = [
  { value: "hide", label: "HIDE" },
  { value: "show", label: "SHOW" },
  { value: "require", label: "REQUIRE" },
  { value: "suppress", label: "SUPPRESS" },
];

interface InspectionQuestion {
  id: string;
  key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  show_on_client: boolean;
  required_for_submission: boolean;
  render_as_scale: boolean;
}

interface InspectionRule {
  id: string;
  section: string;
  job_types: string[];
  action: string;
  target_question: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function InspectionRulesEditor() {
  const queryClient = useQueryClient();

  // -- Service Codes (DB-driven job type list) --
  const { data: serviceCodes = [] } = useQuery({
    queryKey: ["service_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_codes")
        .select("code, job_type, label, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as { code: string; job_type: string; label: string; is_active: boolean }[];
    },
  });

  // Build job type options from service codes, deduped by job_type
  const jobTypeOptions = (() => {
    const seen = new Set<string>();
    const options: { value: string; code: string; label: string }[] = [];
    for (const sc of serviceCodes) {
      if (!seen.has(sc.job_type)) {
        seen.add(sc.job_type);
        options.push({ value: sc.job_type, code: sc.code, label: sc.label });
      }
    }
    // Add common non-code job types
    for (const extra of [
      { value: "general_repair", code: "", label: "General Repair" },
      { value: "case_restoration", code: "", label: "Case Restoration" },
      { value: "small_job", code: "", label: "Small Job" },
      { value: "other", code: "", label: "Other" },
    ]) {
      if (!seen.has(extra.value)) {
        seen.add(extra.value);
        options.push(extra);
      }
    }
    return options;
  })();

  // Map job_type -> code for display
  const jobTypeToCode = new Map<string, string>();
  for (const sc of serviceCodes) {
    if (!jobTypeToCode.has(sc.job_type)) {
      jobTypeToCode.set(sc.job_type, sc.code);
    }
  }

  const getJobTypeLabel = (value: string) => {
    const code = jobTypeToCode.get(value);
    const opt = jobTypeOptions.find((o) => o.value === value);
    const label = opt?.label || value.replace(/_/g, " ");
    return code ? `${code} – ${label}` : label;
  };

  // -- Questions --
  const { data: questions = [] } = useQuery({
    queryKey: ["inspection_questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_questions").select("*").order("key");
      if (error) throw error;
      return data as InspectionQuestion[];
    },
  });

  const [editingQKey, setEditingQKey] = useState<string | null>(null);
  const [editQLabel, setEditQLabel] = useState("");
  const [editQDesc, setEditQDesc] = useState("");

  // Pending toggle changes (staged until Save)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { show_on_client?: boolean; required_for_submission?: boolean; render_as_scale?: boolean }>>({});


  const togglePending = (key: string, field: "show_on_client" | "required_for_submission" | "render_as_scale", currentDbValue: boolean) => {
    setPendingChanges((prev) => {
      const existing = prev[key] || {};
      const currentEffective = existing[field] ?? currentDbValue;
      const newValue = !currentEffective;
      const updated = { ...existing, [field]: newValue };
      // If toggled back to DB value, remove that field
      if (newValue === currentDbValue) {
        delete updated[field];
      }
      const next = { ...prev, [key]: updated };
      // If no changes left for this key, remove it
      if (Object.keys(next[key]).length === 0) delete next[key];
      return next;
    });
  };

  const saveAllChanges = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(pendingChanges);
      for (const [key, updates] of entries) {
        const { error } = await supabase.from("inspection_questions").update(updates).eq("key", key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection_questions"] });
      setPendingChanges({});
      toast.success(`Saved ${Object.keys(pendingChanges).length} question(s)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateQuestion = useMutation({
    mutationFn: async (payload: { key: string; label?: string; description?: string; show_on_client?: boolean; required_for_submission?: boolean }) => {
      const { key, ...updates } = payload;
      const { error } = await supabase.from("inspection_questions").update(updates).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection_questions"] });
      setEditingQKey(null);
      toast.success("Question updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // -- Rules --
  const { data: rules = [] } = useQuery({
    queryKey: ["inspection_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_rules").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data as InspectionRule[];
    },
  });

  const [newRule, setNewRule] = useState({
    section: "W",
    job_types: [] as string[],
    action: "hide",
    target_question: "Q1",
    description: "",
    isDefault: false,
  });

  const createRule = useMutation({
    mutationFn: async (rule: typeof newRule) => {
      const maxOrder = rules.reduce((m, r) => Math.max(m, r.sort_order), 0);
      const minOrder = rules.length > 0 ? Math.min(...rules.map(r => r.sort_order)) : 1;

      let assignedOrder: number;
      if (rule.isDefault) {
        // Default goes to the end (lowest priority)
        assignedOrder = maxOrder + 1;
      } else {
        // Non-default goes before all existing rules (highest priority)
        // Shift all existing rules down by 1
        for (const existing of rules) {
          await supabase.from("inspection_rules").update({ sort_order: existing.sort_order + 1 }).eq("id", existing.id);
        }
        assignedOrder = minOrder > 0 ? minOrder : 1;
      }

      const { error } = await supabase.from("inspection_rules").insert({
        section: rule.section,
        job_types: rule.job_types,
        action: rule.action,
        target_question: rule.target_question,
        description: rule.description || null,
        sort_order: assignedOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection_rules"] });
      setNewRule({ section: "W", job_types: [], action: "hide", target_question: "Q1", description: "", isDefault: false });
      toast.success("Rule created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("inspection_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inspection_rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspection_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection_rules"] });
      toast.success("Rule deleted");
    },
  });

  const swapPrecedence = useMutation({
    mutationFn: async ({ ruleId, targetId, ruleOrder, targetOrder }: { ruleId: string; targetId: string; ruleOrder: number; targetOrder: number }) => {
      const { error: e1 } = await supabase.from("inspection_rules").update({ sort_order: targetOrder }).eq("id", ruleId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("inspection_rules").update({ sort_order: ruleOrder }).eq("id", targetId);
      if (e2) throw e2;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inspection_rules"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getQuestionLabel = (key: string) => questions.find((q) => q.key === key)?.label || key;

  const toggleJobType = (value: string) => {
    setNewRule((prev) => ({
      ...prev,
      job_types: prev.job_types.includes(value) ? prev.job_types.filter((t) => t !== value) : [...prev.job_types, value],
    }));
  };

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      {/* Questions Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-foreground">Questions</h3>
          {Object.keys(pendingChanges).length > 0 && (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={saveAllChanges.isPending}
              onClick={() => saveAllChanges.mutate()}
            >
              <Save className="h-3 w-3 mr-1" />
              Save Changes ({Object.keys(pendingChanges).length})
            </Button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 px-2 mb-1">
          <div className="w-10" />
          <div className="flex-1" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-muted-foreground w-10 text-center">Visible</span>
            <span className="text-[9px] text-muted-foreground w-10 text-center">Required</span>
            <span className="text-[9px] text-muted-foreground w-10 text-center">Scale</span>
          </div>
          <div className="w-5" />
        </div>
        <div className="space-y-1.5">
          {questions.map((q) => (
            <div key={q.key} className="flex items-center gap-1.5 sm:gap-2 p-2 rounded-lg border bg-card text-xs min-w-0 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">{q.key}</Badge>
              {editingQKey === q.key ? (
                <>
                  <Input
                    value={editQLabel}
                    onChange={(e) => setEditQLabel(e.target.value)}
                    className="h-6 text-xs flex-1"
                    placeholder="Label"
                  />
                  <Input
                    value={editQDesc}
                    onChange={(e) => setEditQDesc(e.target.value)}
                    className="h-6 text-xs flex-1"
                    placeholder="Description"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => updateQuestion.mutate({ key: q.key, label: editQLabel, description: editQDesc })}
                  >
                    <Check className="h-3 w-3 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingQKey(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground truncate text-[11px] sm:text-xs">{q.label}</span>
                  {(pendingChanges[q.key]?.render_as_scale ?? q.render_as_scale) && (
                    <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200 shrink-0">1-10 Scale</Badge>
                  )}
                  <span className="text-muted-foreground text-[10px] sm:text-xs line-clamp-2 flex-1 min-w-0 hidden sm:inline">{q.description}</span>
                   <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {(() => {
                      const effective = pendingChanges[q.key]?.show_on_client ?? q.show_on_client;
                      const changed = pendingChanges[q.key]?.show_on_client !== undefined;
                      return (
                        <button
                          onClick={() => togglePending(q.key, "show_on_client", q.show_on_client)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors min-w-[32px] ${
                            effective
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : "bg-red-50 text-red-600 border-red-200"
                          } ${changed ? "ring-2 ring-amber-400" : ""}`}
                          title="Show on client approval"
                        >
                          {effective ? "YES" : "NO"}
                        </button>
                      );
                    })()}
                    {(() => {
                      const effective = pendingChanges[q.key]?.required_for_submission ?? q.required_for_submission;
                      const changed = pendingChanges[q.key]?.required_for_submission !== undefined;
                      return (
                        <button
                          onClick={() => togglePending(q.key, "required_for_submission", q.required_for_submission)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors min-w-[32px] ${
                            effective
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : "bg-red-50 text-red-600 border-red-200"
                          } ${changed ? "ring-2 ring-amber-400" : ""}`}
                          title="Required for submission"
                        >
                          {effective ? "YES" : "NO"}
                        </button>
                      );
                    })()}
                    {(() => {
                      const effective = pendingChanges[q.key]?.render_as_scale ?? q.render_as_scale;
                      const changed = pendingChanges[q.key]?.render_as_scale !== undefined;
                      return (
                        <button
                          onClick={() => togglePending(q.key, "render_as_scale", q.render_as_scale)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors min-w-[32px] ${
                            effective
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : "bg-muted text-muted-foreground border-border"
                          } ${changed ? "ring-2 ring-amber-400" : ""}`}
                          title="Render as 1-10 scale instead of Yes/No"
                        >
                          {effective ? "ON" : "OFF"}
                        </button>
                      );
                    })()}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      setEditingQKey(q.key);
                      setEditQLabel(q.label);
                      setEditQDesc(q.description || "");
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* New Rule Builder */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-2">Add Rule</h3>
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Section */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">If Section</label>
                <select
                  value={newRule.section}
                  onChange={(e) => setNewRule((p) => ({ ...p, section: e.target.value }))}
                  className="w-full h-7 text-xs border rounded px-2 bg-background"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule((p) => ({ ...p, action: e.target.value }))}
                  className="w-full h-7 text-xs border rounded px-2 bg-background"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>

              {/* Target Question */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Question</label>
                <select
                  value={newRule.target_question}
                  onChange={(e) => setNewRule((p) => ({ ...p, target_question: e.target.value }))}
                  className="w-full h-7 text-xs border rounded px-2 bg-background"
                >
                  {questions.map((q) => (
                    <option key={q.key} value={q.key}>{q.key} – {q.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Note</label>
                <Input
                  value={newRule.description}
                  onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional note"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Job Types Multi-select */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">When Job Type is (select service codes)</label>
              <div className="flex flex-wrap gap-1">
                {jobTypeOptions.map((jt) => (
                  <button
                    key={jt.value}
                    onClick={() => toggleJobType(jt.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                      newRule.job_types.includes(jt.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {jt.code ? `${jt.code} – ${jt.label}` : jt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRule.isDefault}
                  onChange={(e) => setNewRule((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-[10px] text-muted-foreground font-medium">
                  Set as Default (lowest priority — applies when no higher-priority rule matches)
                </span>
              </label>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={createRule.isPending}
                onClick={() => createRule.mutate(newRule)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules by Precedence */}
      <div>
        <h3 className="text-xs font-bold text-foreground mb-1">Rules by Precedence ({rules.length})</h3>
        <p className="text-[10px] text-muted-foreground mb-2">
          Lower number = higher priority. The first matching rule wins. Use the last rule as the "default" behavior.
        </p>
        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rules configured yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rules.map((rule, idx) => {
              const sectionLabel = SECTIONS.find((s) => s.value === rule.section)?.label || rule.section;
              const isFirst = idx === 0;
              const isLast = idx === rules.length - 1;
              const isDefault = isLast;
              return (
                <div
                  key={rule.id}
                  className={`p-2 rounded-lg border text-xs ${
                    rule.is_active ? "bg-card" : "bg-muted/30 opacity-60"
                  } ${isDefault ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2 flex-wrap">
                  {/* Precedence number & reorder */}
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <button
                      disabled={isFirst || swapPrecedence.isPending}
                      onClick={() => {
                        const prev = rules[idx - 1];
                        swapPrecedence.mutate({ ruleId: rule.id, targetId: prev.id, ruleOrder: rule.sort_order, targetOrder: prev.sort_order });
                      }}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-bold text-foreground">#{rule.sort_order}</span>
                    <button
                      disabled={isLast || swapPrecedence.isPending}
                      onClick={() => {
                        const next = rules[idx + 1];
                        swapPrecedence.mutate({ ruleId: rule.id, targetId: next.id, ruleOrder: rule.sort_order, targetOrder: next.sort_order });
                      }}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  {isDefault && (
                    <Badge variant="secondary" className="text-[9px] shrink-0 bg-primary/10 text-primary border-primary/20">DEFAULT</Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      rule.action === "hide"
                        ? "border-red-300 text-red-700"
                        : rule.action === "require"
                        ? "border-emerald-300 text-emerald-700"
                        : rule.action === "suppress"
                        ? "border-amber-300 text-amber-700"
                        : "border-blue-300 text-blue-700"
                    }`}
                  >
                    {rule.action.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-foreground">{getQuestionLabel(rule.target_question)}</span>
                  <span className="text-muted-foreground">when</span>
                  <Badge variant="secondary" className="text-[10px]">{sectionLabel}</Badge>
                  {rule.job_types.length > 0 && (
                    <>
                      <span className="text-muted-foreground">has</span>
                      <div className="flex gap-0.5 flex-wrap flex-1">
                        {rule.job_types.map((jt) => (
                          <Badge key={jt} variant="outline" className="text-[9px]">
                            {getJobTypeLabel(jt)}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                  {rule.job_types.length === 0 && (
                    <span className="text-muted-foreground italic flex-1">(any job type)</span>
                  )}
                  {rule.description && (
                    <span className="text-muted-foreground/70 text-[10px] italic truncate max-w-[120px]">{rule.description}</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })}
                      title={rule.is_active ? "Disable" : "Enable"}
                    >
                      {rule.is_active ? <Power className="h-3 w-3 text-emerald-600" /> : <PowerOff className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-destructive"
                      onClick={() => { if (confirm("Delete this rule?")) deleteRule.mutate(rule.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
