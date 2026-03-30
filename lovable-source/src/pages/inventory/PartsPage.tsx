import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Package, DollarSign, Building2, Box, Loader2, AlertTriangle, Download, Upload, Pencil, Trash2, X, Check, CheckSquare, Square, FileSpreadsheet, ChevronDown, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CSVInstructionsDialog } from '@/components/inventory/CSVInstructionsDialog';

type Part = {
  id: string;
  part_number: string;
  description: string;
  item_type: string;
  uom: string;
  average_cost: number | null;
  last_cost: number | null;
  lowest_cost: number | null;
  highest_cost: number | null;
  default_sell_price: number | null;
  reorder_point: number | null;
  max_qty: number | null;
  category: string | null;
  brand: string | null;
  is_active: boolean;
  created_at: string;
};

type InventoryStock = {
  qty_on_hand: number;
  qty_allocated: number;
  qty_on_order: number;
  bins: {
    name: string;
    locations: {
      name: string;
      stores: {
        name: string;
      };
    };
  };
};

const ITEM_TYPES = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'non_inventory', label: 'Non-Inventory' },
  { value: 'service', label: 'Service' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'client_watch', label: 'Client Watch' },
];

const UOM_TYPES = [
  { value: 'ea', label: 'Each (ea)' },
  { value: 'hr', label: 'Hour (hr)' },
  { value: 'box', label: 'Box' },
  { value: 'set', label: 'Set' },
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'ft', label: 'Foot (ft)' },
  { value: 'in', label: 'Inch (in)' },
];

import { RELATED_PART_CATEGORIES } from '@/lib/constants';

type ImportPreview = {
  updates: { id: string; part_number: string; current_type: string; new_type: string; action: 'update' | 'deactivate' }[];
  summary: Record<string, number>;
  totalRecords: number;
  unchangedCount: number;
  deactivateCount: number;
};

export default function PartsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [newPart, setNewPart] = useState({
    part_number: '',
    description: '',
    item_type: 'inventory',
    uom: 'ea',
    default_sell_price: '',
    reorder_point: '0',
    max_qty: '',
    starting_cost: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editPart, setEditPart] = useState<Partial<Part> | null>(null);
  
  // Bulk edit state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkRelatedTo, setBulkRelatedTo] = useState<string>('');

  // Robust CSV parser (handles commas + newlines inside quotes)
  const parseCSV = (csvText: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = '';
    };

    const pushRow = () => {
      pushField();
      // Ignore completely empty rows
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    };

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        pushField();
        continue;
      }

      if (char === '\r') {
        if (nextChar === '\n') i++;
        pushRow();
        continue;
      }

      if (char === '\n') {
        pushRow();
        continue;
      }

      field += char;
    }

    pushRow();

    // Strip BOM on first header cell if present
    if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    return rows;
  };

  // Parse CSV and show preview
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: 'Reading CSV…', description: file.name });
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast({ title: 'Invalid CSV', description: 'File must have headers and at least one row', variant: 'destructive' });
        return;
      }

      // Parse headers
      const headers = rows[0].map((h) => h.trim());
      const idIndex = headers.indexOf('id');
      const itemTypeIndex = headers.indexOf('item_type');
      const partNumberIndex = headers.indexOf('part_number');

      if (idIndex === -1 || itemTypeIndex === -1) {
        toast({ title: 'Invalid CSV', description: 'CSV must have "id" and "item_type" columns', variant: 'destructive' });
        return;
      }

      // Parse rows
      const parsedRows: { id: string; part_number: string; new_type: string; action: 'update' | 'deactivate' }[] = [];
      const validTypes = ITEM_TYPES.map((t) => t.value);
      const invalidTypes = new Set<string>();
      let rowsWithMissingId = 0;
      let rowsWithMissingType = 0;

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        const id = values[idIndex]?.trim();
        const itemType = values[itemTypeIndex]?.toLowerCase().trim();
        const partNumber = partNumberIndex !== -1 ? values[partNumberIndex] : '';

        if (!id) {
          rowsWithMissingId++;
          continue;
        }
        if (!itemType) {
          rowsWithMissingType++;
          continue;
        }

        // Handle "delete" as a special deactivate action
        if (itemType === 'delete') {
          parsedRows.push({ id, part_number: partNumber, new_type: 'delete', action: 'deactivate' });
        } else if (validTypes.includes(itemType)) {
          parsedRows.push({ id, part_number: partNumber, new_type: itemType, action: 'update' });
        } else {
          invalidTypes.add(itemType);
        }
      }

      if (parsedRows.length === 0) {
        const details: string[] = [];
        if (rowsWithMissingId > 0) details.push(`${rowsWithMissingId} rows missing id`);
        if (rowsWithMissingType > 0) details.push(`${rowsWithMissingType} rows missing item_type`);
        if (invalidTypes.size > 0) details.push(`Invalid types found: ${[...invalidTypes].join(', ')}`);
        details.push(`Valid types are: ${validTypes.join(', ')}`);
        
        toast({ 
          title: 'No valid updates', 
          description: details.join('. '), 
          variant: 'destructive' 
        });
        return;
      }

      // Fetch current types from database (chunked to avoid URL length limits)
      const ids = Array.from(new Set(parsedRows.map((r) => r.id)));
      const chunkSize = 50;
      const idChunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) idChunks.push(ids.slice(i, i + chunkSize));

      const chunkResults = await Promise.all(
        idChunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from('parts')
            .select('id, part_number, item_type, is_active')
            .in('id', chunk);
          if (error) throw error;
          return data ?? [];
        })
      );

      const currentParts = chunkResults.flat();
      const currentMap = new Map(currentParts.map((p: any) => [p.id, p]));
      
      // Build preview with only actual changes
      const updates: ImportPreview['updates'] = [];
      const summary: Record<string, number> = {};
      const totalRecords = parsedRows.length;
      let deactivateCount = 0;

      for (const row of parsedRows) {
        const current = currentMap.get(row.id);
        if (!current) continue;

        if (row.action === 'deactivate') {
          // Only add if currently active
          if (current.is_active !== false) {
            deactivateCount++;
            updates.push({
              id: row.id,
              part_number: current.part_number || row.part_number,
              current_type: current.item_type,
              new_type: 'deactivate',
              action: 'deactivate',
            });
          }
        } else if (current.item_type !== row.new_type) {
          const changeKey = `${current.item_type} → ${row.new_type}`;
          summary[changeKey] = (summary[changeKey] || 0) + 1;
          updates.push({
            id: row.id,
            part_number: current.part_number || row.part_number,
            current_type: current.item_type,
            new_type: row.new_type,
            action: 'update',
          });
        }
      }

      const unchangedCount = totalRecords - updates.length;

      if (updates.length === 0) {
        toast({ title: 'No changes detected', description: 'All item types already match the CSV' });
        return;
      }

      setImportPreview({ updates, summary, totalRecords, unchangedCount, deactivateCount });
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  // Commit the import
  const commitImport = async () => {
    if (!importPreview) return;

    setIsCommitting(true);
    try {
      const byType = new Map<string, string[]>();
      const toDeactivate: string[] = [];
      
      for (const u of importPreview.updates) {
        if (u.action === 'deactivate') {
          toDeactivate.push(u.id);
        } else {
          const list = byType.get(u.new_type) ?? [];
          list.push(u.id);
          byType.set(u.new_type, list);
        }
      }

      const chunkSize = 50;
      let successCount = 0;
      let errorCount = 0;
      let deactivatedCount = 0;

      // Handle type updates
      for (const [newType, ids] of byType.entries()) {
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('parts')
            .update({ item_type: newType as any })
            .in('id', chunk);

          if (error) {
            errorCount += chunk.length;
          } else {
            successCount += chunk.length;
          }
        }
      }

      // Handle deactivations
      for (let i = 0; i < toDeactivate.length; i += chunkSize) {
        const chunk = toDeactivate.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('parts')
          .update({ is_active: false })
          .in('id', chunk);

        if (error) {
          errorCount += chunk.length;
        } else {
          deactivatedCount += chunk.length;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setImportPreview(null);
      
      const messages: string[] = [];
      if (successCount > 0) messages.push(`${successCount} updated`);
      if (deactivatedCount > 0) messages.push(`${deactivatedCount} deactivated`);
      if (errorCount > 0) messages.push(`${errorCount} failed`);
      
      toast({
        title: 'Import complete',
        description: messages.join(', '),
      });
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsCommitting(false);
    }
  };

  // Fetch parts
  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts', search, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('parts')
        .select('*')
        .eq('is_active', true)
        .order('part_number');

      const rawTokens = search ? search.trim().split(/\s+/) : [];
      const tokens = rawTokens
        .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
        .filter(t => t.length > 0);

      // Multi-token search: return anything matching ANY token (order-independent).
      // We'll sort results so items matching MORE tokens appear first.
      if (tokens.length > 0) {
        const orConditions = tokens
          .flatMap(t => [`part_number.ilike.%${t}%`, `description.ilike.%${t}%`])
          .join(',');
        query = query.or(orConditions);
      }

      if (typeFilter !== 'all') {
        query = query.eq('item_type', typeFilter as any);
      }

      // When searching, pull more rows so we don't miss matches due to ordering/limits.
      const maxRows = tokens.length > 0 ? 5000 : 500;

      const { data, error } = await query.range(0, maxRows - 1);
      if (error) throw error;

      let results = data as Part[];

      if (tokens.length > 1) {
        results = results
          .map(part => {
            const haystack = `${part.part_number || ''} ${part.description || ''}`.toLowerCase();
            const matchCount = tokens.reduce(
              (count, t) => count + (haystack.includes(t.toLowerCase()) ? 1 : 0),
              0
            );
            return { part, matchCount };
          })
          .filter(x => x.matchCount > 0)
          .sort(
            (a, b) =>
              b.matchCount - a.matchCount ||
              String(a.part.part_number).localeCompare(String(b.part.part_number))
          )
          .map(x => x.part);
      }

      return results;
    },
  });

  // Stats query for missing cost
  const { data: partsStats } = useQuery({
    queryKey: ['parts-stats-missing-cost'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('average_cost, last_cost, item_type')
        .eq('is_active', true)
        .in('item_type', ['inventory', 'non_inventory']);
      
      if (error) throw error;
      
      const missingCost = data?.filter(p => 
        (p.average_cost === null || p.average_cost === 0) && 
        (p.last_cost === null || p.last_cost === 0)
      ).length || 0;
      
      return { missingCost, total: data?.length || 0 };
    },
  });

  // Export CSV function
  const exportToCSV = async () => {
    // Fetch all matching records (not limited)
    let query = supabase
      .from('parts')
      .select('id, part_number, description, item_type, uom, average_cost, last_cost, default_sell_price, reorder_point, max_qty, category, brand, is_active')
      .order('part_number');

    const rawTokens = search ? search.trim().split(/\s+/) : [];
    const tokens = rawTokens
      .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
      .filter(t => t.length > 0);

    if (tokens.length > 0) {
      const orConditions = tokens
        .flatMap(t => [`part_number.ilike.%${t}%`, `description.ilike.%${t}%`])
        .join(',');
      query = query.or(orConditions);
    }
    
    if (typeFilter !== 'all') {
      query = query.eq('item_type', typeFilter as any);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
      return;
    }

    // Sort export results the same way as the list: most token matches first
    let results = data;
    if (tokens.length > 1 && data) {
      results = [...data]
        .map(part => {
          const haystack = `${part.part_number || ''} ${part.description || ''}`.toLowerCase();
          const matchCount = tokens.reduce(
            (count, t) => count + (haystack.includes(t.toLowerCase()) ? 1 : 0),
            0
          );
          return { part, matchCount };
        })
        .filter(x => x.matchCount > 0)
        .sort(
          (a, b) =>
            b.matchCount - a.matchCount ||
            String(a.part.part_number).localeCompare(String(b.part.part_number))
        )
        .map(x => x.part);
    }
    if (!results || results.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }

    // Create CSV content
    const headers = ['id', 'part_number', 'description', 'item_type', 'uom', 'average_cost', 'last_cost', 'default_sell_price', 'reorder_point', 'max_qty', 'category', 'brand', 'is_active'];
    const csvRows = [headers.join(',')];
    
    for (const row of results) {
      const values = headers.map(h => {
        const val = row[h as keyof typeof row];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parts-export-${typeFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: `Exported ${results.length} items` });
  };

  // Fetch inventory for selected part
  const { data: partInventory } = useQuery({
    queryKey: ['part-inventory', selectedPart?.id],
    queryFn: async () => {
      if (!selectedPart) return null;
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          qty_on_hand,
          qty_allocated,
          qty_on_order,
          bins (
            name,
            locations (
              name,
              stores (name)
            )
          )
        `)
        .eq('part_id', selectedPart.id);
      if (error) throw error;
      return data as InventoryStock[];
    },
    enabled: !!selectedPart,
  });

  // Fetch vendor parts for selected part
  const { data: vendorParts } = useQuery({
    queryKey: ['vendor-parts', selectedPart?.id],
    queryFn: async () => {
      if (!selectedPart) return null;
      const { data, error } = await supabase
        .from('vendor_parts')
        .select(`
          *,
          vendors (name)
        `)
        .eq('part_id', selectedPart.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPart,
  });

  // Create part mutation
  const createPartMutation = useMutation({
    mutationFn: async () => {
      const startingCost = newPart.starting_cost ? parseFloat(newPart.starting_cost) : null;
      const { data, error } = await supabase
        .from('parts')
        .insert({
          part_number: newPart.part_number,
          description: newPart.description,
          item_type: newPart.item_type as any,
          uom: newPart.uom as any,
          default_sell_price: newPart.default_sell_price ? parseFloat(newPart.default_sell_price) : null,
          reorder_point: parseInt(newPart.reorder_point) || 0,
          max_qty: newPart.max_qty ? parseInt(newPart.max_qty) : null,
          last_cost: startingCost,
          average_cost: startingCost,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setIsCreateOpen(false);
      setNewPart({
        part_number: '',
        description: '',
        item_type: 'inventory',
        uom: 'ea',
        default_sell_price: '',
        reorder_point: '0',
        max_qty: '',
        starting_cost: '',
      });
      toast({ title: 'Part created successfully' });
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.message?.includes('parts_part_number_key')) {
        message = 'A part with this part number already exists. Please use a unique part number.';
      }
      toast({ title: 'Error creating part', description: message, variant: 'destructive' });
    },
  });

  const totalOnHand = partInventory?.reduce((sum, inv) => sum + (inv.qty_on_hand || 0), 0) || 0;
  const totalAllocated = partInventory?.reduce((sum, inv) => sum + (inv.qty_allocated || 0), 0) || 0;
  const totalOnOrder = partInventory?.reduce((sum, inv) => sum + (inv.qty_on_order || 0), 0) || 0;

  // Update part mutation
  const updatePartMutation = useMutation({
    mutationFn: async (updates: Partial<Part>) => {
      if (!selectedPart) throw new Error('No part selected');

      // Only send fields that actually changed.
      // This avoids triggering DB constraints/triggers on unchanged values.
      const payload: Record<string, any> = {};
      const setIfChanged = (key: keyof Part, next: any) => {
        if (next === undefined) return;
        const prev = (selectedPart as any)[key];
        if (next !== prev) payload[key as string] = next;
      };

      setIfChanged('part_number', typeof updates.part_number === 'string' ? updates.part_number.trim() : updates.part_number);
      setIfChanged('description', typeof updates.description === 'string' ? updates.description.trim() : updates.description);
      setIfChanged('item_type', updates.item_type);
      setIfChanged('uom', updates.uom);
      setIfChanged('default_sell_price', updates.default_sell_price);
      setIfChanged('reorder_point', updates.reorder_point);
      setIfChanged('max_qty', updates.max_qty);
      setIfChanged('category', updates.category);

      if (Object.keys(payload).length === 0) return;

      const { error } = await supabase
        .from('parts')
        .update(payload)
        .eq('id', selectedPart.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setIsEditing(false);
      setEditPart(null);
      if (selectedPart && editPart) {
        setSelectedPart({ ...selectedPart, ...editPart } as Part);
      }
      toast({ title: 'Part updated successfully' });
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.message?.includes('parts_part_number_key')) {
        message = 'A part with this part number already exists. Please use a unique part number.';
      }
      toast({ title: 'Error updating part', description: message, variant: 'destructive' });
    },
  });

  // Delete part mutation (deactivate)
  const deletePartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error('No part selected');
      const { error } = await supabase
        .from('parts')
        .update({ is_active: false })
        .eq('id', selectedPart.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setSelectedPart(null);
      toast({ title: 'Part deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting part', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk update "Related To" mutation
  const bulkUpdateRelatedToMutation = useMutation({
    mutationFn: async ({ ids, category }: { ids: string[]; category: string }) => {
      const chunkSize = 50;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('parts')
          .update({ category: category || null })
          .in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setSelectedIds(new Set());
      setIsBulkEditOpen(false);
      setBulkRelatedTo('');
      toast({ title: `Updated ${selectedIds.size} items` });
    },
    onError: (error: any) => {
      toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' });
    },
  });

  const startEditing = () => {
    if (!selectedPart) return;
    setEditPart({
      part_number: selectedPart.part_number,
      description: selectedPart.description,
      item_type: selectedPart.item_type,
      uom: selectedPart.uom,
      default_sell_price: selectedPart.default_sell_price,
      reorder_point: selectedPart.reorder_point,
      max_qty: selectedPart.max_qty,
      category: selectedPart.category,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditPart(null);
  };

  const saveEditing = () => {
    if (editPart) {
      updatePartMutation.mutate(editPart);
    }
  };

  // Checkbox handlers
  const toggleSelectPart = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllServiceParts = () => {
    const serviceParts = parts?.filter(p => p.item_type === 'service') || [];
    if (selectedIds.size === serviceParts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(serviceParts.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Filter parts for service type when bulk editing
  const servicePartsInSelection = parts?.filter(p => selectedIds.has(p.id) && p.item_type === 'service') || [];

  return (
    <>
      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={(open) => !open && setImportPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-auto flex-1">
            {/* Summary Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Total records in CSV</TableCell>
                    <TableCell className="text-right font-medium">{importPreview?.totalRecords}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Records to be changed</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {(importPreview?.updates.length ?? 0) - (importPreview?.deactivateCount ?? 0)}
                    </TableCell>
                  </TableRow>
                  {importPreview && importPreview.deactivateCount > 0 && (
                    <TableRow>
                      <TableCell className="text-destructive">Records to be deactivated</TableCell>
                      <TableCell className="text-right font-medium text-destructive">{importPreview.deactivateCount}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell>Records unchanged</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">{importPreview?.unchangedCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Changes by Type */}
            {importPreview && Object.keys(importPreview.summary).length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type Change</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(importPreview.summary).map(([change, count]) => (
                      <TableRow key={change}>
                        <TableCell className="font-mono">{change}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Current Type</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview?.updates.slice(0, 50).map((u) => (
                    <TableRow key={u.id} className={u.action === 'deactivate' ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono text-sm">{u.part_number}</TableCell>
                      <TableCell><Badge variant="outline">{u.current_type}</Badge></TableCell>
                      <TableCell>
                        {u.action === 'deactivate' ? (
                          <Badge variant="destructive">Deactivate</Badge>
                        ) : (
                          <Badge>{u.new_type}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importPreview && importPreview.updates.length > 50 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                  ...and {importPreview.updates.length - 50} more
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button onClick={commitImport} disabled={isCommitting}>
              {isCommitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Apply {importPreview?.updates.length} Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Related To Dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set "Related To" for {servicePartsInSelection.length} Services</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will update the "Related To" field for all selected service items. This field is used in email templates to specify what type of item was received.
            </p>
            <div>
              <Label>Related To</Label>
              <Select value={bulkRelatedTo} onValueChange={setBulkRelatedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">— Clear (no category) —</SelectItem>
                  {RELATED_PART_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => bulkUpdateRelatedToMutation.mutate({ 
                  ids: servicePartsInSelection.map(p => p.id), 
                  category: bulkRelatedTo === 'clear' ? '' : bulkRelatedTo 
                })}
                disabled={!bulkRelatedTo || bulkUpdateRelatedToMutation.isPending}
              >
                {bulkUpdateRelatedToMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update {servicePartsInSelection.length} Items
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Missing Cost Metric */}
      {partsStats && partsStats.missingCost > 0 && (
        <div className="p-4 border-b bg-background">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{partsStats.missingCost}</p>
                  <p className="text-sm text-muted-foreground">Parts Missing Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
      {/* Parts List */}
      <div className="w-96 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Parts</h2>
            <div className="flex items-center gap-2">
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Part</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Part Number *</Label>
                        <Input 
                          value={newPart.part_number} 
                          onChange={(e) => setNewPart({ ...newPart, part_number: e.target.value })} 
                          placeholder="Enter part number"
                        />
                      </div>
                      <div>
                        <Label>Item Type</Label>
                        <Select value={newPart.item_type} onValueChange={(v) => setNewPart({ ...newPart, item_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Description *</Label>
                      <Input 
                        value={newPart.description} 
                        onChange={(e) => setNewPart({ ...newPart, description: e.target.value })} 
                        placeholder="Enter description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>UoM</Label>
                        <Select value={newPart.uom} onValueChange={(v) => setNewPart({ ...newPart, uom: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UOM_TYPES.map((u) => (
                              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Sell Price</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={newPart.default_sell_price} 
                          onChange={(e) => setNewPart({ ...newPart, default_sell_price: e.target.value })} 
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Starting Cost</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={newPart.starting_cost} 
                          onChange={(e) => setNewPart({ ...newPart, starting_cost: e.target.value })} 
                          placeholder="Initial cost for first entry"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Reorder Point</Label>
                        <Input 
                          type="number" 
                          value={newPart.reorder_point} 
                          onChange={(e) => setNewPart({ ...newPart, reorder_point: e.target.value })} 
                          placeholder="Min qty"
                        />
                      </div>
                      <div>
                        <Label>Reorder Up To</Label>
                        <Input 
                          type="number" 
                          value={newPart.max_qty} 
                          onChange={(e) => setNewPart({ ...newPart, max_qty: e.target.value })} 
                          placeholder="Max qty"
                        />
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => createPartMutation.mutate()}
                      disabled={!newPart.part_number || !newPart.description || createPartMutation.isPending}
                    >
                      {createPartMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Part
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search parts..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setSelectedIds(new Set()); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeFilter === 'service' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={selectAllServiceParts}
                title="Select all service items"
              >
                {selectedIds.size === parts?.filter(p => p.item_type === 'service').length ? 'Deselect' : 'Select'} All
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV} title="Export CSV">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/inventory/parts/import')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Parts (Fishbowl)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory/parts/import-qty')}>
                  <Package className="h-4 w-4 mr-2" />
                  Quantities (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/inventory/parts/import-pricing')}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Retail Pricing (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CSVInstructionsDialog />
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </div>
          {parts && (
            <div className="text-xs text-muted-foreground">
              {parts.length} items {parts.length === 500 && '(max displayed)'}
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="p-3 border-b bg-primary/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedIds.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
            {servicePartsInSelection.length > 0 && (
              <Button size="sm" onClick={() => setIsBulkEditOpen(true)}>
                Set Related To ({servicePartsInSelection.length})
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : parts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No parts found</p>
            </div>
          ) : (
            <div className="divide-y">
              {parts?.map((part) => (
                <div
                  key={part.id}
                  className={`flex items-center gap-2 hover:bg-muted/50 transition-colors ${
                    selectedPart?.id === part.id ? 'bg-muted' : ''
                  }`}
                >
                  {/* Checkbox for service items */}
                  {part.item_type === 'service' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectPart(part.id);
                      }}
                      className="pl-3 py-3 text-muted-foreground hover:text-foreground"
                    >
                      {selectedIds.has(part.id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPart(part)}
                    className={`flex-1 text-left p-3 ${part.item_type === 'service' ? 'pl-0' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-medium text-sm truncate">{part.part_number}</p>
                        <p className="text-sm text-muted-foreground truncate">{part.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {part.item_type === 'service' && part.category && (
                          <Badge variant="secondary" className="text-xs">
                            {RELATED_PART_CATEGORIES.find(c => c.value === part.category)?.label || part.category}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {part.item_type}
                        </Badge>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Part Details */}
      <div className="flex-1 overflow-auto">
        {selectedPart ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editPart?.part_number || ''}
                      onChange={(e) => setEditPart({ ...editPart, part_number: e.target.value })}
                      className="text-xl font-semibold"
                      placeholder="Part Number"
                    />
                    <Input
                      value={editPart?.description || ''}
                      onChange={(e) => setEditPart({ ...editPart, description: e.target.value })}
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-serif font-semibold">{selectedPart.part_number}</h1>
                    <p className="text-muted-foreground">{selectedPart.description}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Select
                      value={editPart?.item_type || ''}
                      onValueChange={(v) => setEditPart({ ...editPart, item_type: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={saveEditing} disabled={updatePartMutation.isPending}>
                      {updatePartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge className="text-sm">{selectedPart.item_type}</Badge>
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Part</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{selectedPart.part_number}"? This will deactivate the part and hide it from lists.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePartMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletePartMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{totalOnHand}</div>
                      <p className="text-sm text-muted-foreground">On Hand</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{totalOnOrder}</div>
                      <p className="text-sm text-muted-foreground">On Order</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{totalAllocated}</div>
                      <p className="text-sm text-muted-foreground">Allocated</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{totalOnHand - totalAllocated}</div>
                      <p className="text-sm text-muted-foreground">Available</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Part Info */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Part Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">UoM</span>
                        {isEditing ? (
                          <Select
                            value={editPart?.uom || ''}
                            onValueChange={(v) => setEditPart({ ...editPart, uom: v })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UOM_TYPES.map((u) => (
                                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="font-medium uppercase">{selectedPart.uom}</span>
                        )}
                      </div>
                      {(selectedPart.item_type === 'service' || editPart?.item_type === 'service') && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Related Part</span>
                          {isEditing ? (
                            <Select
                              value={editPart?.category || ''}
                              onValueChange={(v) => setEditPart({ ...editPart, category: v })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {RELATED_PART_CATEGORIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="font-medium capitalize">
                              {RELATED_PART_CATEGORIES.find(c => c.value === selectedPart.category)?.label || selectedPart.category || '—'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reorder Point</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editPart?.reorder_point ?? ''}
                            onChange={(e) => setEditPart({ ...editPart, reorder_point: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-24 text-right"
                          />
                        ) : (
                          <span className="font-medium">{selectedPart.reorder_point || 0}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reorder Up To</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editPart?.max_qty ?? ''}
                            onChange={(e) => setEditPart({ ...editPart, max_qty: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-24 text-right"
                          />
                        ) : (
                          <span className="font-medium">{selectedPart.max_qty || '-'}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Costing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average Cost</span>
                        <span className="font-medium">${(selectedPart.average_cost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Cost</span>
                        <span className="font-medium">${(selectedPart.last_cost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lowest Paid</span>
                        <span className="font-medium text-success">${(selectedPart.lowest_cost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Highest Paid</span>
                        <span className="font-medium text-destructive">${(selectedPart.highest_cost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-muted-foreground">Sell Price</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editPart?.default_sell_price ?? ''}
                            onChange={(e) => setEditPart({ ...editPart, default_sell_price: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-24 text-right"
                          />
                        ) : (
                          <span className="font-bold">${(selectedPart.default_sell_price || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Reorder Alert */}
                {totalOnHand <= (selectedPart.reorder_point || 0) && (
                  <Card className="border-warning">
                    <CardContent className="pt-4 flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <div>
                        <p className="font-medium">Below Reorder Point</p>
                        <p className="text-sm text-muted-foreground">
                          Current stock ({totalOnHand}) is at or below reorder point ({selectedPart.reorder_point})
                        </p>
                      </div>
                      <Button className="ml-auto" size="sm">Create PO</Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="inventory" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory by Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {partInventory?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Store</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Bin</TableHead>
                            <TableHead className="text-right">On Hand</TableHead>
                            <TableHead className="text-right">Allocated</TableHead>
                            <TableHead className="text-right">Available</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {partInventory.map((inv, i) => (
                            <TableRow key={i}>
                              <TableCell>{inv.bins?.locations?.stores?.name}</TableCell>
                              <TableCell>{inv.bins?.locations?.name}</TableCell>
                              <TableCell className="font-mono">{inv.bins?.name}</TableCell>
                              <TableCell className="text-right">{inv.qty_on_hand}</TableCell>
                              <TableCell className="text-right">{inv.qty_allocated}</TableCell>
                              <TableCell className="text-right font-medium">
                                {inv.qty_on_hand - inv.qty_allocated}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No inventory records</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vendors" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Vendor Information</CardTitle>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" /> Add Vendor
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {vendorParts?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Vendor Part #</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead>Pack Qty</TableHead>
                            <TableHead>Lead Time</TableHead>
                            <TableHead>Preferred</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendorParts.map((vp) => (
                            <TableRow key={vp.id}>
                              <TableCell className="font-medium">{vp.vendors?.name}</TableCell>
                              <TableCell className="font-mono">{vp.vendor_part_number || '-'}</TableCell>
                              <TableCell className="text-right">${(vp.vendor_cost || 0).toFixed(2)}</TableCell>
                              <TableCell>{vp.vendor_pack_qty}</TableCell>
                              <TableCell>{vp.lead_time_days ? `${vp.lead_time_days} days` : '-'}</TableCell>
                              <TableCell>
                                {vp.is_preferred && <Badge variant="default">Preferred</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No vendors assigned</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No transaction history available</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Select a part to view details</p>
              <p className="text-sm">or create a new part</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  );
}
