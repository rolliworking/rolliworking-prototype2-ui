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
  Minus,
} from 'lucide-react';

// Column mapping options for Fishbowl CSV
const FISHBOWL_COLUMNS = [
  { value: 'PartNumber', label: 'PartNumber' },
  { value: 'PartDescription', label: 'PartDescription' },
  { value: 'UOM', label: 'UOM' },
  { value: 'UPC', label: 'UPC' },
  { value: 'PartType', label: 'PartType' },
  { value: 'Active', label: 'Active' },
  { value: 'POItemType', label: 'POItemType' },
];

// Target field mappings
const TARGET_FIELDS = [
  { value: 'part_number', label: 'Part #', required: true },
  { value: 'description', label: 'Description', required: true },
  { value: 'uom', label: 'UOM' },
  { value: 'upc', label: 'UPC' },
  { value: 'item_type', label: 'Item Type' },
  { value: 'is_active', label: 'Active' },
];

type ItemType = 'inventory' | 'non_inventory' | 'service' | 'client_watch' | 'assembly' | 'client_property';
type UomType = 'ea' | 'box' | 'ft' | 'hr' | 'in' | 'lb' | 'oz' | 'set';

interface ParsedRow {
  rowIndex: number;
  partNumber: string;
  description: string;
  uom: UomType;
  upc: string;
  itemType: ItemType;
  isActive: boolean;
  raw: Record<string, string>;
}

interface DiffRow {
  status: 'new' | 'update' | 'unchanged' | 'deactivate';
  csvRow: ParsedRow;
  existingPart?: {
    id: string;
    part_number: string;
    description: string;
    uom: string;
    upc: string | null;
    item_type: string;
    is_active: boolean;
  };
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm' | 'complete';

const FishbowlImportPage = () => {
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
  const [importedCount, setImportedCount] = useState({ new: 0, updated: 0 });
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 100;

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
        if (normalized === 'partnumber' || normalized === 'part number' || normalized === 'part#') {
          autoMapping['part_number'] = header;
        } else if (normalized === 'partdescription' || normalized === 'description') {
          autoMapping['description'] = header;
        } else if (normalized === 'uom') {
          autoMapping['uom'] = header;
        } else if (normalized === 'upc') {
          autoMapping['upc'] = header;
        } else if (normalized === 'parttype' || normalized === 'part type' || normalized === 'type') {
          autoMapping['item_type'] = header;
        } else if (normalized === 'active') {
          autoMapping['is_active'] = header;
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
    if (!columnMapping['part_number'] || !columnMapping['description']) {
      toast.error('Part # and Description mappings are required');
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

      const partTypeRaw = getValue('item_type').toLowerCase();
      let itemType: ItemType = 'inventory';
      if (partTypeRaw === 'non-inventory' || partTypeRaw === 'noninventory') {
        itemType = 'non_inventory';
      } else if (partTypeRaw === 'service') {
        itemType = 'service';
      }

      const activeRaw = getValue('is_active').toLowerCase();
      const isActive = activeRaw !== 'false' && activeRaw !== 'no' && activeRaw !== '0';

      const raw: Record<string, string> = {};
      csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });

      // Validate and convert UOM
      const uomRaw = getValue('uom').toLowerCase() || 'ea';
      const validUoms: UomType[] = ['ea', 'box', 'ft', 'hr', 'in', 'lb', 'oz', 'set'];
      const uom: UomType = validUoms.includes(uomRaw as UomType) ? (uomRaw as UomType) : 'ea';

      return {
        rowIndex: idx,
        partNumber: getValue('part_number'),
        description: getValue('description'),
        uom,
        upc: getValue('upc'),
        itemType,
        isActive,
        raw,
      };
    }).filter(r => r.partNumber); // Skip empty part numbers

    setParsedData(parsed);
    return parsed;
  };

  // Fetch existing parts and compute diff
  const computeDiff = async () => {
    const parsed = parseWithMapping();
    if (!parsed || parsed.length === 0) return;

    // Fetch all existing parts by part_number
    const partNumbers = parsed.map(p => p.partNumber);
    
    // Batch fetch in chunks of 500
    const existingParts: Map<string, DiffRow['existingPart']> = new Map();
    for (let i = 0; i < partNumbers.length; i += 500) {
      const batch = partNumbers.slice(i, i + 500);
      const { data } = await supabase
        .from('parts')
        .select('id, part_number, description, uom, upc, item_type, is_active')
        .in('part_number', batch);
      
      data?.forEach(p => existingParts.set(p.part_number, p));
    }

    // Compute diff
    const diff: DiffRow[] = parsed.map(csvRow => {
      const existing = existingParts.get(csvRow.partNumber);
      
      if (!existing) {
        return { status: 'new' as const, csvRow };
      }

      // Check for changes
      const changes: DiffRow['changes'] = [];
      
      if (existing.description !== csvRow.description) {
        changes.push({
          field: 'Description',
          oldValue: existing.description,
          newValue: csvRow.description,
        });
      }
      
      if ((existing.uom || 'ea') !== csvRow.uom) {
        changes.push({
          field: 'UOM',
          oldValue: existing.uom || 'ea',
          newValue: csvRow.uom,
        });
      }
      
      if ((existing.upc || '') !== csvRow.upc) {
        changes.push({
          field: 'UPC',
          oldValue: existing.upc || '',
          newValue: csvRow.upc,
        });
      }
      
      if (existing.item_type !== csvRow.itemType) {
        changes.push({
          field: 'Item Type',
          oldValue: existing.item_type,
          newValue: csvRow.itemType,
        });
      }

      if (!csvRow.isActive && existing.is_active) {
        return { status: 'deactivate' as const, csvRow, existingPart: existing, changes };
      }

      if (changes.length === 0) {
        return { status: 'unchanged' as const, csvRow, existingPart: existing };
      }

      return { status: 'update' as const, csvRow, existingPart: existing, changes };
    });

    setDiffData(diff);
    setStep('preview');
    
    const newCount = diff.filter(d => d.status === 'new').length;
    const updateCount = diff.filter(d => d.status === 'update').length;
    const unchangedCount = diff.filter(d => d.status === 'unchanged').length;
    const deactivateCount = diff.filter(d => d.status === 'deactivate').length;
    
    toast.success(`Preview ready: ${newCount} new, ${updateCount} updates, ${unchangedCount} unchanged, ${deactivateCount} to deactivate`);
  };

  // Filter diff data
  const filteredDiff = useMemo(() => {
    return diffData.filter(row => {
      const matchesSearch = !searchTerm || 
        row.csvRow.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.csvRow.description.toLowerCase().includes(searchTerm.toLowerCase());
      
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
    deactivate: diffData.filter(d => d.status === 'deactivate').length,
  }), [diffData]);

  // Paginated data
  const paginatedDiff = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredDiff.slice(start, start + PAGE_SIZE);
  }, [filteredDiff, currentPage]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = diffData.filter(d => d.status === 'new' || d.status === 'update' || d.status === 'deactivate');
      let newCount = 0;
      let updateCount = 0;
      const batchSize = 50;

      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize);
        
        const { error } = await supabase.from('parts').upsert(
          batch.map(item => ({
            part_number: item.csvRow.partNumber,
            description: item.csvRow.description,
            uom: item.csvRow.uom,
            upc: item.csvRow.upc || null,
            item_type: item.csvRow.itemType,
            is_active: item.csvRow.isActive,
          })),
          { onConflict: 'part_number', ignoreDuplicates: false }
        );

        if (error) throw error;
        
        batch.forEach(item => {
          if (item.status === 'new') newCount++;
          else updateCount++;
        });
      }

      return { new: newCount, updated: updateCount };
    },
    onSuccess: (counts) => {
      setImportedCount(counts);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success(`Import complete: ${counts.new} new, ${counts.updated} updated`);
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
      case 'deactivate':
        return <Badge variant="destructive"><Minus className="w-3 h-3 mr-1" />Deactivate</Badge>;
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/parts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Fishbowl Parts Import</h1>
          <p className="text-muted-foreground">Import parts from Fishbowl CSV export</p>
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
              Upload Fishbowl CSV
            </CardTitle>
            <CardDescription>
              Export parts from Fishbowl and upload the CSV file here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-lg font-medium">Click to upload CSV</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Fishbowl Part Export (.csv)
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
            <div className="grid grid-cols-2 gap-4">
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
                <strong>Preview:</strong> Found {csvRows.length} rows in CSV. 
                First part: {csvRows[0]?.[csvHeaders.indexOf(columnMapping['part_number'] || '')] || 'N/A'}
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
                <div className="text-2xl font-bold text-red-600">{stats.deactivate}</div>
                <div className="text-sm text-red-600">Deactivate</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search part # or description..."
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
                <SelectItem value="deactivate">Deactivate</SelectItem>
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
                    <TableHead>Description</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDiff.map((row, idx) => (
                    <TableRow key={idx} className={row.status === 'unchanged' ? 'opacity-50' : ''}>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="font-mono text-sm">{row.csvRow.partNumber}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.csvRow.description}</TableCell>
                      <TableCell>
                        {row.changes?.map((c, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{c.field}:</span>{' '}
                            <span className="text-red-500 line-through">{c.oldValue || '(empty)'}</span>
                            {' → '}
                            <span className="text-green-600">{c.newValue || '(empty)'}</span>
                          </div>
                        ))}
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
              disabled={stats.new === 0 && stats.update === 0 && stats.deactivate === 0}
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
              This action will modify your parts database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>{stats.new}</strong> new parts will be created</li>
                  <li><strong>{stats.update}</strong> existing parts will be updated</li>
                  <li><strong>{stats.deactivate}</strong> parts will be deactivated</li>
                  <li><strong>{stats.unchanged}</strong> parts will remain unchanged</li>
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
                    Import Parts
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
                Successfully imported <strong>{importedCount.new}</strong> new parts and 
                updated <strong>{importedCount.updated}</strong> existing parts.
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

export default FishbowlImportPage;
