import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  FileText, 
  GripVertical,
  Search,
  Copy,
} from 'lucide-react';
import { 
  useEstimateTemplates, 
  useEstimateTemplate,
  useCreateEstimateTemplate, 
  useUpdateEstimateTemplate, 
  useDeleteEstimateTemplate,
  EstimateTemplate,
} from '@/hooks/useEstimateTemplates';
import { PartsSearchInput } from '@/components/estimates/PartsSearchInput';
import { AddPartDialog } from '@/components/estimates/AddPartDialog';
import { CalcInput } from '@/components/ui/calc-input';

interface TemplateLineForm {
  id: string;
  product: string;
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  part_id?: string | null;
}

export default function EstimateTemplatesPage() {
  const { data: templates, isLoading } = useEstimateTemplates();
  const createTemplate = useCreateEstimateTemplate();
  const updateTemplate = useUpdateEstimateTemplate();
  const deleteTemplate = useDeleteEstimateTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EstimateTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLines, setFormLines] = useState<TemplateLineForm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add part dialog state
  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [addPartLineId, setAddPartLineId] = useState<string | null>(null);
  const [addPartInitialValue, setAddPartInitialValue] = useState('');

  // Fetch template details when editing
  const { data: templateDetails } = useEstimateTemplate(editingTemplate?.id || null);

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormLines([{ id: '1', product: '', description: '', quantity: 1, unit_price: 0, taxable: false }]);
    setDialogOpen(true);
  };

  const openEditDialog = (template: EstimateTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    // Reset while loading (avoids showing stale lines from the previous dialog)
    setFormLines([{ id: '1', product: '', description: '', quantity: 1, unit_price: 0, taxable: false }]);
    setDialogOpen(true);
  };

  // Load template lines when template details are fetched
  useEffect(() => {
    if (templateDetails && editingTemplate) {
      setFormLines(
        templateDetails.lines.map((line) => ({
          id: line.id,
          product: line.part?.part_number || '',
          description: line.description,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          taxable: line.taxable,
          part_id: line.part_id,
        }))
      );
    }
  }, [templateDetails, editingTemplate]);

  const addLine = () => {
    setFormLines([...formLines, {
      id: String(Date.now()),
      product: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      taxable: false,
    }]);
  };

  const updateLine = (id: string, field: keyof TemplateLineForm, value: any) => {
    setFormLines(lines => lines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const removeLine = (id: string) => {
    if (formLines.length > 1) {
      setFormLines(lines => lines.filter(line => line.id !== id));
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    setFormLines(lines => {
      const newLines = [...lines];
      const [draggedItem] = newLines.splice(draggedIndex, 1);
      newLines.splice(dropIndex, 0, draggedItem);
      return newLines;
    });
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (closeAfter: boolean) => {
    if (!formName.trim()) return;

    setIsSaving(true);
    const linesData = formLines.filter(l => l.description.trim()).map((line, index) => ({
      part_id: line.part_id || null,
      service_subcategory_id: null,
      line_type: 'service' as const,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      taxable: line.taxable,
      sort_order: index,
    }));

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: formName,
          description: formDescription,
          lines: linesData,
        });
      } else {
        const result = await createTemplate.mutateAsync({
          name: formName,
          description: formDescription,
          lines: linesData,
        });
        // After creating, switch to edit mode so subsequent saves update instead of create
        if (!closeAfter && result) {
          setEditingTemplate(result);
        }
      }
      
      if (closeAfter) {
        setDialogOpen(false);
      } else {
        toast.success('Template saved');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => handleSave(true);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  const handleDuplicate = async (template: EstimateTemplate) => {
    // Fetch full template with lines
    const { data: templateData, error: templateError } = await supabase
      .from('estimate_templates')
      .select('*')
      .eq('id', template.id)
      .single();
    if (templateError) {
      toast.error('Failed to fetch template');
      return;
    }

    const { data: lines, error: linesError } = await supabase
      .from('estimate_template_lines')
      .select('*')
      .eq('template_id', template.id)
      .order('sort_order');
    if (linesError) {
      toast.error('Failed to fetch template lines');
      return;
    }

    // Create duplicate with "-copy" suffix
    await createTemplate.mutateAsync({
      name: `${templateData.name}-copy`,
      description: templateData.description || '',
      lines: (lines || []).map((line, index) => ({
        part_id: line.part_id,
        service_subcategory_id: line.service_subcategory_id,
        line_type: line.line_type,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        taxable: line.taxable,
        sort_order: index,
      })),
    });
  };

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="qbo-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-serif font-semibold text-slate-900">Estimate Templates</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Create reusable templates for common estimate types
                </p>
              </div>
              <Button onClick={openCreateDialog} className="qbo-btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No templates yet</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Create your first template to speed up estimate creation
                </p>
                <Button onClick={openCreateDialog} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-slate-500">{template.description || '—'}</TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(template.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(template)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(template)}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(template.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            // The part search dropdown is portaled to <body>, so Radix would treat it as "outside".
            // Prevent the dialog from dismissing so clicks can select items.
            if (target?.closest('[data-parts-search-dropdown]')) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Define a reusable set of line items for estimates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Template Name *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Full Service Overhaul"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this template"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Line Items</label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="w-8 px-2 py-2"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Product/Service</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">Description</th>
                      <th className="w-20 px-3 py-2 text-right text-xs font-medium text-slate-600">Qty</th>
                      <th className="w-24 px-3 py-2 text-right text-xs font-medium text-slate-600">Rate</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.map((line, index) => (
                      <tr 
                        key={line.id} 
                        className={`border-t ${draggedIndex === index ? 'opacity-50 bg-slate-100' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="px-2 py-1.5 cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                        </td>
                        <td className="px-1 py-1">
                          <PartsSearchInput
                            value={line.product}
                            onChange={(val) => updateLine(line.id, 'product', val)}
                            onPartSelect={(part) => {
                              updateLine(line.id, 'product', part.part_number);
                              updateLine(line.id, 'description', part.description);
                              updateLine(line.id, 'part_id', part.id);
                              if (part.default_sell_price != null) {
                                updateLine(line.id, 'unit_price', part.default_sell_price);
                              }
                            }}
                            onAddPart={() => {
                              setAddPartLineId(line.id);
                              setAddPartInitialValue(line.product);
                              setAddPartDialogOpen(true);
                            }}
                            className="h-8 text-xs"
                            placeholder="Search parts..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value) || 0)}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <CalcInput
                            value={line.unit_price}
                            onChange={(value) => updateLine(line.id, 'unit_price', value)}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => removeLine(line.id)}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="mt-2">
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {editingTemplate && (
              <Button 
                variant="outline"
                onClick={() => handleSave(false)} 
                disabled={!formName.trim() || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              disabled={!formName.trim() || isSaving}
              className="qbo-btn-primary"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Save & Close' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Part Dialog */}
      <AddPartDialog
        open={addPartDialogOpen}
        onOpenChange={setAddPartDialogOpen}
        initialPartNumber={addPartInitialValue}
        onPartCreated={(part) => {
          if (addPartLineId) {
            updateLine(addPartLineId, 'product', part.part_number);
            updateLine(addPartLineId, 'description', part.description);
            updateLine(addPartLineId, 'part_id', part.id);
            if (part.default_sell_price != null) {
              updateLine(addPartLineId, 'unit_price', part.default_sell_price);
            }
          }
        }}
      />
    </div>
  );
}
