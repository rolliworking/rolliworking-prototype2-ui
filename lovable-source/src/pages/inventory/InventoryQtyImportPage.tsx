import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Package,
} from 'lucide-react';

// Target field mappings for inventory qty import
const TARGET_FIELDS = [
  { value: 'part_number', label: 'Part #', required: true },
  { value: 'bin_name', label: 'Bin/Location', required: true },
  { value: 'qty', label: 'Quantity', required: true },
  { value: 'cost', label: 'Cost', required: false },
];

interface ParsedRow {
  rowIndex: number;
  partNumber: string;
  binName: string;
  qty: number;
  cost: number | null;
  raw: Record<string, string>;
}

interface DiffRow {
  status: 'new' | 'update' | 'unchanged' | 'error';
  csvRow: ParsedRow;
  existingStock?: {
    id: string;
    part_id: string;
    bin_id: string;
    qty_on_hand: number;
  };
  partId?: string;
  binId?: string;
  errorMessage?: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm' | 'complete';

const MAIN_STORE_ID = '0d64e7de-6c85-4cf0-8d47-a1393610a03b'; // Main Warehouse

const InventoryQtyImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [diffData, setDiffData] = useState<DiffRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmText, setConfirmText] = useState('');
  const [importedCount, setImportedCount] = useState({ new: 0, updated: 0, binsCreated: 0, costsUpdated: 0 });
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 100;

  // Fetch default location for creating bins
  const { data: defaultLocation } = useQuery({
    queryKey: ['default-location'],
    queryFn: async () => {
      // First try to get existing location
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .eq('store_id', MAIN_STORE_ID)
        .limit(1)
        .single();
      
      if (existing) return existing.id;

      // Create default location if none exists
      const { data: newLoc, error } = await supabase
        .from('locations')
        .insert({ name: 'Default', store_id: MAIN_STORE_ID })
        .select('id')
        .single();
      
      if (error) throw error;
      return newLoc.id;
    },
  });

  // Robust CSV parser
  const parseCSVText = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    const pushCell = () => {
      row.push(cell.replace(/\r?\n/g, ' ').trim());
      cell = '';
    };

    const pushRow = () => {
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        pushCell();
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        pushCell();
        pushRow();
        if (char === '\r' && text[i + 1] === '\n') i++;
        continue;
      }

      cell += char;
    }

    pushCell();
    pushRow();

    // Strip BOM
    if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    return rows;
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSVText(text);
      
      if (rows.length < 2) {
        toast.error('CSV file appears to be empty');
        return;
      }

      const headers = rows[0];
      setCsvHeaders(headers);
      setCsvRows(rows.slice(1));

      // Auto-map columns based on header names
      const autoMapping: Record<string, string> = {};
      headers.forEach(header => {
        const normalized = header.toLowerCase().trim();
        if (normalized === 'partnumber' || normalized === 'part number' || normalized === 'part#' || normalized === 'part' || normalized === 'sku') {
          autoMapping['part_number'] = header;
        } else if (normalized === 'bin' || normalized === 'binname' || normalized === 'bin name' || normalized === 'location' || normalized === 'locationgroup') {
          autoMapping['bin_name'] = header;
        } else if (normalized === 'qty' || normalized === 'quantity' || normalized === 'qtyonhand' || normalized === 'qty on hand' || normalized === 'onhand') {
          autoMapping['qty'] = header;
        } else if (normalized === 'cost' || normalized === 'unitcost' || normalized === 'unit cost' || normalized === 'avgcost' || normalized === 'average cost') {
          autoMapping['cost'] = header;
        }
      });

      setColumnMapping(autoMapping);
      setStep('mapping');
      toast.success(`Loaded ${rows.length - 1} rows from CSV`);
    };
    reader.readAsText(file);
  };

  // Parse data with current mapping
  const parseWithMapping = () => {
    if (!columnMapping['part_number'] || !columnMapping['bin_name'] || !columnMapping['qty']) {
      toast.error('Part #, Bin Name, and Quantity mappings are required');
      return;
    }

    const headerIndexMap: Record<string, number> = {};
    csvHeaders.forEach((h, i) => { headerIndexMap[h] = i; });

    const parsed: ParsedRow[] = csvRows.map((row, idx) => {
      const getValue = (field: string) => {
        const csvCol = columnMapping[field];
        if (!csvCol) return '';
        const colIdx = headerIndexMap[csvCol];
        return colIdx !== undefined ? (row[colIdx] || '') : '';
      };

      const raw: Record<string, string> = {};
      csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });

      const qtyStr = getValue('qty').replace(/,/g, '');
      const qty = parseFloat(qtyStr) || 0;

      const costStr = getValue('cost').replace(/,/g, '');
      const cost = costStr ? parseFloat(costStr) : null;

      // Transform bin name: strip "Main-" prefix if present (e.g., "Main-Stock" → "Stock")
      let rawBinName = getValue('bin_name');
      if (rawBinName.startsWith('Main-')) {
        rawBinName = rawBinName.substring(5); // Remove "Main-" prefix
      }

      return {
        rowIndex: idx,
        partNumber: getValue('part_number'),
        binName: rawBinName,
        qty,
        cost,
        raw,
      };
    }).filter(r => r.partNumber && r.binName); // Skip rows without part# or bin

    setParsedData(parsed);
    return parsed;
  };

  // Fetch existing parts/bins and compute diff
  const computeDiff = async () => {
    const parsed = parseWithMapping();
    if (!parsed || parsed.length === 0) return;

    // Fetch all existing parts by part_number
    const partNumbers = [...new Set(parsed.map(p => p.partNumber))];
    const binNames = [...new Set(parsed.map(p => p.binName))];
    
    // Batch fetch parts
    const existingParts: Map<string, string> = new Map(); // part_number -> id
    for (let i = 0; i < partNumbers.length; i += 500) {
      const batch = partNumbers.slice(i, i + 500);
      const { data } = await supabase
        .from('parts')
        .select('id, part_number')
        .in('part_number', batch);
      
      data?.forEach(p => existingParts.set(p.part_number, p.id));
    }

    // Batch fetch bins
    const existingBins: Map<string, string> = new Map(); // bin_name -> id
    const { data: binsData } = await supabase
      .from('bins')
      .select('id, name')
      .in('name', binNames);
    
    binsData?.forEach(b => existingBins.set(b.name, b.id));

    // Fetch existing inventory_stock
    const existingStock: Map<string, DiffRow['existingStock']> = new Map(); // part_id|bin_id -> stock
    const partIds = [...existingParts.values()];
    const binIds = [...existingBins.values()];
    
    if (partIds.length > 0 && binIds.length > 0) {
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select('id, part_id, bin_id, qty_on_hand')
        .in('part_id', partIds)
        .in('bin_id', binIds);
      
      stockData?.forEach(s => {
        existingStock.set(`${s.part_id}|${s.bin_id}`, s);
      });
    }

    // Compute diff
    const diff: DiffRow[] = parsed.map(csvRow => {
      const partId = existingParts.get(csvRow.partNumber);
      
      if (!partId) {
        return { 
          status: 'error' as const, 
          csvRow, 
          errorMessage: `Part # "${csvRow.partNumber}" not found` 
        };
      }

      const binId = existingBins.get(csvRow.binName);
      
      // Bin doesn't exist - will create it
      if (!binId) {
        return { 
          status: 'new' as const, 
          csvRow, 
          partId,
          binId: undefined, // Will be created
        };
      }

      const stockKey = `${partId}|${binId}`;
      const existing = existingStock.get(stockKey);
      
      if (!existing) {
        // Stock record doesn't exist - will create
        return { 
          status: 'new' as const, 
          csvRow, 
          partId,
          binId,
        };
      }

      // Check for qty change
      if (existing.qty_on_hand === csvRow.qty) {
        return { 
          status: 'unchanged' as const, 
          csvRow, 
          existingStock: existing,
          partId,
          binId,
        };
      }

      return { 
        status: 'update' as const, 
        csvRow, 
        existingStock: existing,
        partId,
        binId,
        changes: [{
          field: 'Qty',
          oldValue: String(existing.qty_on_hand),
          newValue: String(csvRow.qty),
        }],
      };
    });

    setDiffData(diff);
    setStep('preview');
    
    const newCount = diff.filter(d => d.status === 'new').length;
    const updateCount = diff.filter(d => d.status === 'update').length;
    const unchangedCount = diff.filter(d => d.status === 'unchanged').length;
    const errorCount = diff.filter(d => d.status === 'error').length;
    
    toast.success(`Preview ready: ${newCount} new, ${updateCount} updates, ${unchangedCount} unchanged, ${errorCount} errors`);
  };

  // Filter diff data
  const filteredDiff = useMemo(() => {
    return diffData.filter(row => {
      const matchesSearch = !searchTerm || 
        row.csvRow.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.csvRow.binName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [diffData, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: diffData.length,
    new: diffData.filter(d => d.status === 'new').length,
    update: diffData.filter(d => d.status === 'update').length,
    unchanged: diffData.filter(d => d.status === 'unchanged').length,
    error: diffData.filter(d => d.status === 'error').length,
  }), [diffData]);

  // Paginated data
  const paginatedDiff = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredDiff.slice(start, start + PAGE_SIZE);
  }, [filteredDiff, currentPage]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!defaultLocation) {
        throw new Error('No default location available');
      }

      const toImport = diffData.filter(d => d.status === 'new' || d.status === 'update');
      let newCount = 0;
      let updateCount = 0;
      let binsCreated = 0;
      let costsUpdated = 0;
      const batchSize = 50;

      // First, create any missing bins
      const binsToCreate = [...new Set(
        toImport
          .filter(d => !d.binId)
          .map(d => d.csvRow.binName)
      )];

      const createdBins: Map<string, string> = new Map();
      if (binsToCreate.length > 0) {
        const { data: newBins, error: binError } = await supabase
          .from('bins')
          .insert(binsToCreate.map(name => ({
            name,
            location_id: defaultLocation,
          })))
          .select('id, name');
        
        if (binError) throw binError;
        newBins?.forEach(b => createdBins.set(b.name, b.id));
        binsCreated = newBins?.length || 0;
      }

      // Collect parts that need cost updates (group by part, use first cost found)
      const partCostUpdates: Map<string, number> = new Map();
      toImport.forEach(item => {
        if (item.partId && item.csvRow.cost !== null && item.csvRow.cost > 0) {
          if (!partCostUpdates.has(item.partId)) {
            partCostUpdates.set(item.partId, item.csvRow.cost);
          }
        }
      });

      // Update part costs in batches
      if (partCostUpdates.size > 0) {
        const costEntries = [...partCostUpdates.entries()];
        for (let i = 0; i < costEntries.length; i += batchSize) {
          const batch = costEntries.slice(i, i + batchSize);
          for (const [partId, cost] of batch) {
            const { error } = await supabase
              .from('parts')
              .update({ average_cost: cost })
              .eq('id', partId);
            if (!error) costsUpdated++;
          }
        }
      }

      // Process stock updates in batches
      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize);
        
        const stockRecords = batch.map(item => {
          const binId = item.binId || createdBins.get(item.csvRow.binName);
          if (!binId || !item.partId) {
            throw new Error(`Missing bin or part for ${item.csvRow.partNumber}`);
          }
          return {
            part_id: item.partId,
            bin_id: binId,
            qty_on_hand: item.csvRow.qty,
          };
        });

        const { error } = await supabase.from('inventory_stock').upsert(
          stockRecords,
          { onConflict: 'part_id,bin_id', ignoreDuplicates: false }
        );

        if (error) throw error;
        
        batch.forEach(item => {
          if (item.status === 'new') newCount++;
          else updateCount++;
        });
      }

      return { new: newCount, updated: updateCount, binsCreated, costsUpdated };
    },
    onSuccess: (counts) => {
      setImportedCount(counts);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success(`Import complete: ${counts.new} new, ${counts.updated} updated, ${counts.binsCreated} bins created, ${counts.costsUpdated} costs updated`);
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const handleImport = () => {
    if (confirmText !== 'CONFIRM') {
      toast.error('Please type CONFIRM to proceed');
      return;
    }
    importMutation.mutate();
  };

  const getStatusBadge = (status: DiffRow['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-green-500"><Plus className="w-3 h-3 mr-1" />New</Badge>;
      case 'update':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1" />Update</Badge>;
      case 'unchanged':
        return <Badge variant="secondary">Unchanged</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/parts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Inventory Quantity Import</h1>
          <p className="text-muted-foreground">Import stock quantities from Fishbowl CSV export</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['upload', 'mapping', 'preview', 'confirm', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary text-primary-foreground' : 
              ['upload', 'mapping', 'preview', 'confirm', 'complete'].indexOf(step) > i 
                ? 'bg-green-500 text-white' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            {i < 4 && <div className="w-12 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Inventory CSV
            </CardTitle>
            <CardDescription>
              Export inventory quantities from Fishbowl and upload the CSV file here.
              Required columns: Part #, Location (bin), Quantity. Optional: Cost (updates average_cost).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-lg font-medium">Click to upload CSV</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Fishbowl Inventory Export (.csv)
                </p>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <Alert className="mt-4">
              <AlertDescription>
                <strong>Note:</strong> This import will set absolute quantities. 
                Parts must already exist in the system. 
                Bins will be created automatically if they don't exist.
                The "Main-" prefix will be stripped from location names (e.g., "Main-Stock" → "Stock").
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Column Mapping</CardTitle>
            <CardDescription>
              Map CSV columns to database fields. Auto-detected mappings shown below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {TARGET_FIELDS.map(field => (
                <div key={field.value} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {field.label}
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </Label>
                  <Select
                    value={columnMapping[field.value] || '__none__'}
                    onValueChange={(val) => setColumnMapping(prev => ({ 
                      ...prev, 
                      [field.value]: val === '__none__' ? '' : val 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Not mapped --</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Alert>
              <AlertDescription>
                <strong>Preview:</strong> Found {csvRows.length} rows in CSV
              </AlertDescription>
            </Alert>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={computeDiff}>
                Preview Changes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.new}</div>
                <div className="text-sm text-green-600">New</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{stats.update}</div>
                <div className="text-sm text-blue-600">Updates</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">{stats.unchanged}</div>
                <div className="text-sm text-muted-foreground">Unchanged</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-sm text-red-600">Errors</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search part # or bin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New Only</SelectItem>
                <SelectItem value="update">Updates Only</SelectItem>
                <SelectItem value="unchanged">Unchanged</SelectItem>
                <SelectItem value="error">Errors Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead>Part #</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Changes / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDiff.map((row, idx) => (
                    <TableRow key={idx} className={row.status === 'unchanged' ? 'opacity-50' : row.status === 'error' ? 'bg-red-50' : ''}>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="font-mono text-sm">{row.csvRow.partNumber}</TableCell>
                      <TableCell>{row.csvRow.binName}</TableCell>
                      <TableCell className="text-right font-mono">{row.csvRow.qty}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {row.csvRow.cost !== null ? `$${row.csvRow.cost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {row.errorMessage && (
                          <span className="text-red-600 text-sm">{row.errorMessage}</span>
                        )}
                        {row.changes?.map((c, i) => (
                          <div key={i} className="text-xs">
                            <span className="text-red-500">{c.oldValue}</span>
                            {' → '}
                            <span className="text-green-600">{c.newValue}</span>
                          </div>
                        ))}
                        {row.status === 'new' && !row.binId && (
                          <span className="text-amber-600 text-xs">+ new bin</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>

          {/* Pagination */}
          {filteredDiff.length > PAGE_SIZE && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="py-2 px-4 text-sm text-muted-foreground">
                Page {currentPage + 1} of {Math.ceil(filteredDiff.length / PAGE_SIZE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(currentPage + 1) * PAGE_SIZE >= filteredDiff.length}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              onClick={() => setStep('confirm')}
              disabled={stats.new === 0 && stats.update === 0}
            >
              Continue to Import
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Import
            </CardTitle>
            <CardDescription>
              This action will modify your inventory stock levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>{stats.new}</strong> new stock records will be created</li>
                  <li><strong>{stats.update}</strong> existing stock levels will be updated</li>
                  <li><strong>{stats.unchanged}</strong> records will remain unchanged</li>
                  <li><strong>{stats.error}</strong> rows will be skipped due to errors</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-text">Type CONFIRM to proceed:</Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="CONFIRM"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('preview')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleImport}
                disabled={confirmText !== 'CONFIRM' || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Import Stock
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully created <strong>{importedCount.new}</strong> new stock records, 
                updated <strong>{importedCount.updated}</strong> existing records
                {importedCount.binsCreated > 0 && (
                  <>, created <strong>{importedCount.binsCreated}</strong> new bins</>
                )}
                {importedCount.costsUpdated > 0 && (
                  <>, updated <strong>{importedCount.costsUpdated}</strong> part costs</>
                )}.
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button onClick={() => navigate('/inventory/parts')}>
                Go to Parts List
              </Button>
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setCsvHeaders([]);
                setCsvRows([]);
                setColumnMapping({});
                setParsedData([]);
                setDiffData([]);
                setConfirmText('');
              }}>
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InventoryQtyImportPage;
