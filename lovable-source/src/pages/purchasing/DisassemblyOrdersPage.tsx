import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, ChevronRight, AlertCircle, Check, Package } from 'lucide-react';

interface DisassemblyLine {
  id: string;
  bom_header_id: string;
  component_part_id: string;
  qty: number;
  notes: string | null;
  sort_order: number | null;
  // Joined from parts
  part_number?: string;
  description?: string;
  // Local state for cost distribution
  unit_cost?: number;
}

interface DisassemblyTemplate {
  id: string;
  bom_name: string;
  description: string | null;
  parent_part_id: string;
  is_active: boolean;
  created_at: string;
  // Joined from parts
  parent_part_number?: string;
  parent_description?: string;
}

export default function DisassemblyOrdersPage() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<DisassemblyTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DisassemblyTemplate | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [lineCosts, setLineCosts] = useState<Record<string, number>>({});
  const [partSearch, setPartSearch] = useState('');

  // Form state for new/edit template
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParentPartId, setFormParentPartId] = useState('');
  const [parentPartSearch, setParentPartSearch] = useState('');

  // Fetch disassembly templates (bom_headers where is_disassembly = true)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['disassembly-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_headers')
        .select(`
          id,
          bom_name,
          description,
          parent_part_id,
          is_active,
          created_at,
          parts!bom_headers_parent_part_id_fkey (
            part_number,
            description
          )
        `)
        .eq('is_disassembly', true)
        .order('bom_name');
      if (error) throw error;
      return data.map((t: any) => ({
        id: t.id,
        bom_name: t.bom_name,
        description: t.description,
        parent_part_id: t.parent_part_id,
        is_active: t.is_active,
        created_at: t.created_at,
        parent_part_number: t.parts?.part_number,
        parent_description: t.parts?.description,
      })) as DisassemblyTemplate[];
    },
  });

  // Fetch template lines when a template is selected
  const { data: selectedTemplateLines = [] } = useQuery({
    queryKey: ['disassembly-template-lines', selectedTemplate?.id],
    queryFn: async () => {
      if (!selectedTemplate?.id) return [];
      const { data, error } = await supabase
        .from('bom_lines')
        .select(`
          id,
          bom_header_id,
          component_part_id,
          qty,
          notes,
          sort_order,
          parts!bom_lines_component_part_id_fkey (
            part_number,
            description
          )
        `)
        .eq('bom_header_id', selectedTemplate.id)
        .order('sort_order');
      if (error) throw error;
      return data.map((l: any) => ({
        id: l.id,
        bom_header_id: l.bom_header_id,
        component_part_id: l.component_part_id,
        qty: Number(l.qty),
        notes: l.notes,
        sort_order: l.sort_order,
        part_number: l.parts?.part_number,
        description: l.parts?.description,
      })) as DisassemblyLine[];
    },
    enabled: !!selectedTemplate?.id,
  });

  // Search parts for adding to template
  const { data: searchResults = [] } = useQuery({
    queryKey: ['parts-search', partSearch],
    queryFn: async () => {
      if (!partSearch.trim()) return [];
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description')
        .or(`part_number.ilike.%${partSearch}%,description.ilike.%${partSearch}%`)
        .eq('is_active', true)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: partSearch.length >= 2,
  });

  // Search parts for parent part selection
  const { data: parentSearchResults = [] } = useQuery({
    queryKey: ['parent-parts-search', parentPartSearch],
    queryFn: async () => {
      if (!parentPartSearch.trim()) return [];
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description')
        .or(`part_number.ilike.%${parentPartSearch}%,description.ilike.%${parentPartSearch}%`)
        .eq('is_active', true)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: parentPartSearch.length >= 2,
  });

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (data: { bom_name: string; description: string; parent_part_id: string }) => {
      const { data: newTemplate, error } = await supabase
        .from('bom_headers')
        .insert({
          bom_name: data.bom_name,
          description: data.description || null,
          parent_part_id: data.parent_part_id,
          is_disassembly: true,
        })
        .select()
        .single();
      if (error) throw error;
      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-templates'] });
      toast.success('Template created');
      setIsCreating(false);
      setFormName('');
      setFormDescription('');
      setFormParentPartId('');
      setParentPartSearch('');
    },
    onError: (error: any) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async (data: { id: string; bom_name: string; description: string }) => {
      const { error } = await supabase
        .from('bom_headers')
        .update({
          bom_name: data.bom_name,
          description: data.description || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-templates'] });
      toast.success('Template updated');
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  // Add line to template
  const addLine = useMutation({
    mutationFn: async (data: { bom_header_id: string; component_part_id: string }) => {
      const maxOrder = selectedTemplateLines.length > 0 
        ? Math.max(...selectedTemplateLines.map(l => l.sort_order || 0)) 
        : 0;
      const { data: newLine, error } = await supabase
        .from('bom_lines')
        .insert({
          bom_header_id: data.bom_header_id,
          component_part_id: data.component_part_id,
          qty: 1,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      if (error) throw error;
      return newLine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-template-lines', selectedTemplate?.id] });
      setPartSearch('');
    },
    onError: (error: any) => {
      toast.error('Failed to add part: ' + error.message);
    },
  });

  // Update line quantity
  const updateLine = useMutation({
    mutationFn: async (data: { id: string; qty: number }) => {
      const { error } = await supabase
        .from('bom_lines')
        .update({ qty: data.qty })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-template-lines', selectedTemplate?.id] });
    },
  });

  // Delete line
  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bom_lines')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-template-lines', selectedTemplate?.id] });
    },
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // Delete lines first
      await supabase.from('bom_lines').delete().eq('bom_header_id', id);
      const { error } = await supabase.from('bom_headers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disassembly-templates'] });
      setSelectedTemplate(null);
      toast.success('Template deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  // Calculate totals
  const totalCost = selectedTemplateLines.reduce((sum, line) => {
    const cost = lineCosts[line.id] || 0;
    return sum + (line.qty * cost);
  }, 0);
  const purchasePriceNum = parseFloat(purchasePrice) || 0;
  const difference = purchasePriceNum - totalCost;
  const isBalanced = Math.abs(difference) < 0.01;

  // Distribute cost evenly
  const distributeCostEvenly = () => {
    if (!purchasePriceNum || selectedTemplateLines.length === 0) return;
    const totalQty = selectedTemplateLines.reduce((sum, l) => sum + l.qty, 0);
    const costPerUnit = purchasePriceNum / totalQty;
    
    const newCosts: Record<string, number> = {};
    selectedTemplateLines.forEach(line => {
      newCosts[line.id] = parseFloat(costPerUnit.toFixed(4));
    });
    setLineCosts(newCosts);
  };

  // Update line cost locally
  const handleCostChange = (lineId: string, cost: number) => {
    setLineCosts(prev => ({ ...prev, [lineId]: cost }));
  };

  // Create purchase order from template
  const createPurchaseOrder = async () => {
    if (!isBalanced) {
      toast.error('Part costs must equal purchase price before creating PO');
      return;
    }
    // TODO: Implement PO creation
    toast.success('Purchase Order creation coming soon!');
  };

  const handleAddPart = (part: { id: string; part_number: string; description: string }) => {
    if (!selectedTemplate) return;
    addLine.mutate({
      bom_header_id: selectedTemplate.id,
      component_part_id: part.id,
    });
  };

  const handleSelectParentPart = (part: { id: string; part_number: string; description: string }) => {
    setFormParentPartId(part.id);
    setParentPartSearch(`${part.part_number} - ${part.description}`);
  };

  return (
    <div className="flex h-full">
      {/* Left panel - Template list */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Disassembly Templates</h2>
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Templates for breaking down assemblies into individual parts
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setPurchasePrice('');
                  setLineCosts({});
                }}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{template.bom_name}</span>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </div>
                <p className="text-xs opacity-70 mt-0.5 truncate">
                  {template.parent_part_number} - {template.parent_description}
                </p>
              </button>
            ))}
            {templates.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No templates yet. Create one to get started.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel - Template detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTemplate ? (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-serif font-semibold">{selectedTemplate.bom_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.parent_part_number} - {selectedTemplate.parent_description}
                  </p>
                  {selectedTemplate.description && (
                    <p className="text-sm mt-1">{selectedTemplate.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(selectedTemplate);
                      setFormName(selectedTemplate.bom_name);
                      setFormDescription(selectedTemplate.description || '');
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this template?')) {
                        deleteTemplate.mutate(selectedTemplate.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Purchase price input */}
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap">Purchase Price:</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="w-32 pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Total Parts Cost:</span>
                  <span className="font-mono font-medium">${totalCost.toFixed(2)}</span>
                </div>

                {purchasePriceNum > 0 && (
                  <Badge variant={isBalanced ? 'default' : 'destructive'} className="flex items-center gap-1">
                    {isBalanced ? (
                      <>
                        <Check className="h-3 w-3" />
                        Balanced
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        Difference: ${difference.toFixed(2)}
                      </>
                    )}
                  </Badge>
                )}

                {purchasePriceNum > 0 && !isBalanced && (
                  <Button variant="outline" size="sm" onClick={distributeCostEvenly}>
                    Distribute Evenly
                  </Button>
                )}
              </div>
            </div>

            {/* Parts table */}
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-4">
                <div className="relative">
                  <Input
                    placeholder="Search parts to add..."
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    className="max-w-md"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-popover border rounded-md shadow-lg z-10">
                      {searchResults.map((part) => (
                        <button
                          key={part.id}
                          onClick={() => handleAddPart(part)}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                        >
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{part.part_number}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="truncate">{part.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-32">Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Cost</TableHead>
                    <TableHead className="w-28 text-right">Ext. Cost</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTemplateLines.map((line, idx) => {
                    const unitCost = lineCosts[line.id] || 0;
                    const extCost = line.qty * unitCost;
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{line.part_number}</TableCell>
                        <TableCell className="text-sm">{line.description}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => updateLine.mutate({ id: line.id, qty: parseInt(e.target.value) || 1 })}
                            className="w-16 text-right h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={unitCost}
                              onChange={(e) => handleCostChange(line.id, parseFloat(e.target.value) || 0)}
                              className="w-24 text-right h-8 text-xs pl-5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${extCost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLine.mutate(line.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {selectedTemplateLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No parts added yet. Search and add parts above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {selectedTemplateLines.length} parts in template
              </div>
              <Button
                onClick={createPurchaseOrder}
                disabled={!isBalanced || selectedTemplateLines.length === 0}
              >
                Create Purchase Order
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a template or create a new one
          </div>
        )}
      </div>

      {/* Create template dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Disassembly Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Rolex 3135 Movement"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Part (the assembly being broken down)</Label>
              <div className="relative">
                <Input
                  placeholder="Search for parent part..."
                  value={parentPartSearch}
                  onChange={(e) => {
                    setParentPartSearch(e.target.value);
                    setFormParentPartId('');
                  }}
                />
                {parentSearchResults.length > 0 && !formParentPartId && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg z-10 max-h-48 overflow-auto">
                    {parentSearchResults.map((part) => (
                      <button
                        key={part.id}
                        onClick={() => handleSelectParentPart(part)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      >
                        <span className="font-mono">{part.part_number}</span>
                        <span className="text-muted-foreground ml-2">— {part.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Notes about this disassembly template..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTemplate.mutate({
                bom_name: formName,
                description: formDescription,
                parent_part_id: formParentPartId,
              })}
              disabled={!formName.trim() || !formParentPartId}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit template dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTemplate) {
                  updateTemplate.mutate({
                    id: editingTemplate.id,
                    bom_name: formName,
                    description: formDescription,
                  });
                }
              }}
              disabled={!formName.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
