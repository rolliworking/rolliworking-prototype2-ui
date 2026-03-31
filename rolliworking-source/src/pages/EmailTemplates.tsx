import { useState, useRef } from "react";
import { Loader2, Mail, Plus, Pencil, Trash2, Copy, Check, X } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_COLORS,
  type EmailTemplate,
  type EmailTemplateType,
} from "@/hooks/use-email-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TEMPLATE_TYPES: EmailTemplateType[] = [
  "movement_service_update",
  "bracelet_work_update",
  "parts_approval",
  "inspection_complete",
  "inspection_notes",
  "inspection_approval",
  "waiting_approval",
  "job_complete",
  "liability_waiver",
  "status_downgrade",
  "bracelet_reply_confirmation",
  "follow_up",
  "custom",
];

const PLACEHOLDERS = [
  { key: "{{customer_first_name}}", label: "First Name" },
  { key: "{{client_name}}", label: "Client Name" },
  { key: "{{brand}}", label: "Brand" },
  { key: "{{model}}", label: "Model" },
  { key: "{{watch_brand}}", label: "Brand (alt)" },
  { key: "{{watch_model}}", label: "Model (alt)" },
  { key: "{{estimate_number}}", label: "Estimate #" },
  { key: "{{Ref_number}}", label: "Ref # (e.g., 1680-44477565)" },
  { key: "{{due_date}}", label: "Due Date" },
  { key: "{{status}}", label: "Status" },
];

export default function EmailTemplates() {
  usePageMeta({
    title: "Email Templates | Rolliworks",
    description: "Manage email templates for client communication",
    canonicalPath: "/email-templates",
  });

  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "custom" as EmailTemplateType,
    subject: "",
    body: "",
    is_active: true,
  });

  const insertPlaceholder = (placeholder: string) => {
    const field = activeField;
    const ref = field === "subject" ? subjectRef.current : bodyRef.current;
    
    if (ref) {
      const start = ref.selectionStart || 0;
      const end = ref.selectionEnd || 0;
      const currentValue = formData[field];
      const newValue = currentValue.slice(0, start) + placeholder + currentValue.slice(end);
      
      setFormData({ ...formData, [field]: newValue });
      
      setTimeout(() => {
        ref.focus();
        const newPos = start + placeholder.length;
        ref.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setFormData({ ...formData, body: formData.body + placeholder });
    }
  };

  const openNew = () => {
    setEditingTemplate(null);
    setFormData({ name: "", type: "custom", subject: "", body: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
    });
    setDialogOpen(true);
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      await createTemplate.mutateAsync({
        name: `${template.name} (Copy)`,
        type: template.type,
        subject: template.subject,
        body: template.body,
        is_active: false, // Start as inactive to avoid confusion
      });
      toast.success("Template duplicated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate template");
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, ...formData });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync(formData);
        toast.success("Template created");
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate.mutateAsync(deleteId);
      toast.success("Template deleted");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Email Templates</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No email templates yet</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {TEMPLATE_TYPES.filter((type) => templates.some((t) => t.type === type)).map((type) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-xs", TEMPLATE_TYPE_COLORS[type])}>
                  {TEMPLATE_TYPE_LABELS[type]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({templates.filter((t) => t.type === type).length})
                </span>
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] text-xs">Name</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="w-[80px] text-center text-xs">Status</TableHead>
                      <TableHead className="w-[140px] text-right text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates
                      .filter((t) => t.type === type)
                      .map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium text-sm py-2">
                            {template.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground py-2 truncate max-w-[300px]">
                            {template.subject}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            {template.is_active ? (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => openEdit(template)}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleDuplicate(template)}
                                disabled={createTemplate.isPending}
                                title="Duplicate"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(template.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as EmailTemplateType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TEMPLATE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                ref={subjectRef}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                onFocus={() => setActiveField("subject")}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body *</Label>
              <Textarea
                id="body"
                ref={bodyRef}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                onFocus={() => setActiveField("body")}
                placeholder="Email body"
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Click to insert placeholder into {activeField === "subject" ? "Subject" : "Body"}:
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => insertPlaceholder(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
