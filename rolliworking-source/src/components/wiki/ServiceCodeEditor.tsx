import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X, Trash2, GripVertical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ServiceCode {
  id: string;
  code: string;
  job_type: string;
  weeks: number;
  label: string;
  is_bracelet: boolean;
  is_movement_service: boolean;
  is_active: boolean;
  sort_order: number;
}

const JOB_TYPE_OPTIONS = [
  "modern_movement", "modern_lv2", "vintage_movement", "vintage_lv2",
  "antique_movement", "antique_lv2", "chrono", "chrono_lv2",
  "case_work", "case_restoration", "warranty", "bracelet_work",
  "bracelet_repair", "gold_bracelet", "stretch_repair", "small_job", "other",
];

export default function ServiceCodeEditor() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServiceCode>>({});
  const [isAdding, setIsAdding] = useState(false);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["service_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_codes")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ServiceCode[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (code: Partial<ServiceCode> & { id?: string }) => {
      if (code.id) {
        const { error } = await supabase
          .from("service_codes")
          .update({
            code: code.code,
            job_type: code.job_type,
            weeks: code.weeks,
            label: code.label,
            is_bracelet: code.is_bracelet,
            is_movement_service: code.is_movement_service,
            is_active: code.is_active,
          })
          .eq("id", code.id);
        if (error) throw error;
      } else {
        const maxOrder = codes.reduce((max, c) => Math.max(max, c.sort_order), 0);
        const { error } = await supabase
          .from("service_codes")
          .insert({
            code: code.code!,
            job_type: code.job_type!,
            weeks: code.weeks ?? 4,
            label: code.label!,
            is_bracelet: code.is_bracelet ?? false,
            is_movement_service: code.is_movement_service ?? false,
            is_active: true,
            sort_order: maxOrder + 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_codes"] });
      setEditingId(null);
      setIsAdding(false);
      setEditForm({});
      toast.success("Service code saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_codes"] });
      toast.success("Service code deleted");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("service_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service_codes"] }),
  });

  const startEdit = (code: ServiceCode) => {
    setEditingId(code.id);
    setEditForm(code);
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ code: "", job_type: "modern_movement", weeks: 4, label: "", is_bracelet: false, is_movement_service: false });
  };

  const handleSave = () => {
    if (!editForm.code?.trim() || !editForm.job_type || !editForm.label?.trim()) {
      toast.error("Code, job type, and label are required");
      return;
    }
    saveMutation.mutate({ ...editForm, id: isAdding ? undefined : editingId! });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Service Code Mappings</h2>
          <p className="text-[11px] text-muted-foreground">
            Maps barcode SC/ST codes to job types and turnaround weeks. These drive the inspection rules engine.
          </p>
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={startAdd} disabled={isAdding}>
          <Plus className="h-3 w-3 mr-1" /> Add Code
        </Button>
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-6 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Code</label>
              <Input
                value={editForm.code || ""}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                placeholder="W"
                className="h-7 text-xs font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Label</label>
              <Input
                value={editForm.label || ""}
                onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                placeholder="Movement Service"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Job Type</label>
              <select
                value={editForm.job_type || ""}
                onChange={(e) => setEditForm({ ...editForm, job_type: e.target.value })}
                className="h-7 w-full text-xs border rounded px-1.5 bg-background"
              >
                {JOB_TYPE_OPTIONS.map((jt) => (
                  <option key={jt} value={jt}>{jt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Weeks</label>
              <Input
                type="number"
                min={1}
                max={52}
                value={editForm.weeks ?? 4}
                onChange={(e) => setEditForm({ ...editForm, weeks: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="new-bracelet"
                  checked={editForm.is_bracelet ?? false}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_bracelet: !!v })}
                />
                <label htmlFor="new-bracelet" className="text-[10px]">Band</label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="new-movement"
                  checked={editForm.is_movement_service ?? false}
                  onCheckedChange={(v) => setEditForm({ ...editForm, is_movement_service: !!v })}
                />
                <label htmlFor="new-movement" className="text-[10px]">Mvmt</label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => { setIsAdding(false); setEditForm({}); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="h-6 text-[11px]" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Job Type</th>
              <th className="px-3 py-2 text-center">Weeks</th>
              <th className="px-3 py-2 text-center">Flags</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {codes.map((code) => {
              const isEditing = editingId === code.id;

              if (isEditing) {
                return (
                  <tr key={code.id} className="bg-primary/5">
                    <td className="px-3 py-1.5">
                      <Input
                        value={editForm.code || ""}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                        className="h-6 text-xs font-mono w-16"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={editForm.label || ""}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="h-6 text-xs"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={editForm.job_type || ""}
                        onChange={(e) => setEditForm({ ...editForm, job_type: e.target.value })}
                        className="h-6 w-full text-xs border rounded px-1 bg-background"
                      >
                        {JOB_TYPE_OPTIONS.map((jt) => (
                          <option key={jt} value={jt}>{jt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Input
                        type="number"
                        min={1}
                        max={52}
                        value={editForm.weeks ?? 4}
                        onChange={(e) => setEditForm({ ...editForm, weeks: Number(e.target.value) })}
                        className="h-6 text-xs w-14 mx-auto text-center"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-center gap-2">
                        <label className="flex items-center gap-1 text-[10px]">
                          <Checkbox
                            checked={editForm.is_bracelet ?? false}
                            onCheckedChange={(v) => setEditForm({ ...editForm, is_bracelet: !!v })}
                          />
                          Band
                        </label>
                        <label className="flex items-center gap-1 text-[10px]">
                          <Checkbox
                            checked={editForm.is_movement_service ?? false}
                            onCheckedChange={(v) => setEditForm({ ...editForm, is_movement_service: !!v })}
                          />
                          Mvmt
                        </label>
                      </div>
                    </td>
                    <td />
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(null); setEditForm({}); }}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button size="icon" className="h-6 w-6" onClick={handleSave} disabled={saveMutation.isPending}>
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={code.id}
                  className={`hover:bg-muted/30 transition-colors ${!code.is_active ? "opacity-40" : ""}`}
                >
                  <td className="px-3 py-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono font-bold">
                      {code.code}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-foreground">{code.label}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {code.job_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{code.weeks}w</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {code.is_movement_service && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">Mvmt</Badge>
                      )}
                      {code.is_bracelet && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">Band</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={code.is_active}
                      onCheckedChange={(v) => toggleActive.mutate({ id: code.id, is_active: !!v })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startEdit(code)}
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete service code "${code.code}"?`)) {
                            deleteMutation.mutate(code.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
