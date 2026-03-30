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
  RefreshCw,
  DollarSign,
} from 'lucide-react';

// Target field mappings
const TARGET_FIELDS = [
  { value: 'part_number', label: 'Part #', required: true },
  { value: 'price', label: 'Retail Price', required: true },
];

interface ParsedRow {
  rowIndex: number;
  partNumber: string;
  price: number;
  raw: Record<string, string>;
}

interface DiffRow {
  status: 'update' | 'unchanged' | 'error';
  csvRow: ParsedRow;
  existingPart?: {
    id: string;
    part_number: string;
    description: string;
    default_sell_price: number | null;
  };
  errorMessage?: string;
  priceChange?: {
    oldValue: number | null;
    newValue: number;
  };
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm' | 'complete';

const cleanCsvText = (value: string) =>
  (value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width + BOM
    .replace(/\u00A0/g, ' ') // non-breaking space
    .trim();

const partKeyExact = (value: string) => cleanCsvText(value).toUpperCase();
const partKeyLoose = (value: string) => partKeyExact(value).replace(/[^A-Z0-9]/g, '');

const RetailPricingImportPage = () => {
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
  const [importedCount, setImportedCount] = useState({ updated: 0, skipped: 0 });
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
      } else if (char === ',' && !inQuotes) {
        pushCell();
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        pushCell();
        pushRow();
      } else {
        cell += char;
      }
    }
    if (cell || row.length) {
      pushCell();
      pushRow();
    }

    return rows;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSVText(text);

      if (rows.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      setCsvHeaders(headers);
      setCsvRows(dataRows);

      // Auto-detect column mappings
      const autoMapping: Record<string, string> = {};
      headers.forEach((header, index) => {
        const h = header.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        // Match "Part#", "Part #", "Part Number", "Product", "SKU", "Item"
        if (h === 'part' || h === 'partn' || h === 'partno' || h === 'partnumber' || 
            h.includes('product') || h.includes('sku') || h.includes('item')) {
          autoMapping.part_number = index.toString();
        }
        if (h.includes('price') || h.includes('retail') || h.includes('sell')) {
          autoMapping.price = index.toString();
        }
      });

      setColumnMapping(autoMapping);
      setStep('mapping');
      toast.success(`Loaded ${dataRows.length} rows`);
    };
    reader.readAsText(file);
  };

  const parseWithMapping = (): ParsedRow[] => {
    const partNumberIdx = columnMapping.part_number ? parseInt(columnMapping.part_number) : -1;
    const priceIdx = columnMapping.price ? parseInt(columnMapping.price) : -1;

    return csvRows
      .map((row, idx) => {
        const raw: Record<string, string> = {};
        csvHeaders.forEach((h, i) => {
          raw[h] = row[i] || '';
        });

        return {
          rowIndex: idx + 2,
          partNumber: partNumberIdx >= 0 ? cleanCsvText(row[partNumberIdx] || '') : '',
          price: priceIdx >= 0 ? parseFloat(cleanCsvText(row[priceIdx] || '')) || 0 : 0,
          raw,
        };
      })
      .filter((r) => r.partNumber !== '');
  };

  const computeDiff = async () => {
    const parsed = parseWithMapping();
    setParsedData(parsed);
    setCurrentPage(0);

    // Fetch parts for lookup (paged to avoid 1000-row default limits)
    const fetchAllPartsForLookup = async () => {
      const pageSize = 1000;
      let from = 0;
      const all: Array<{
        id: string;
        part_number: string;
        description: string;
        default_sell_price: number | null;
      }> = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('parts')
          .select('id, part_number, description, default_sell_price')
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const rows = data || [];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      return all;
    };

    let existingParts: Awaited<ReturnType<typeof fetchAllPartsForLookup>> = [];
    try {
      existingParts = await fetchAllPartsForLookup();
    } catch (e: any) {
      toast.error(`Couldn't load parts for matching: ${e.message || 'Unknown error'}`);
      setDiffData([]);
      setStep('preview');
      return;
    }

    type ExistingPart = (typeof existingParts)[number];

    const addToMap = (map: Map<string, ExistingPart[]>, key: string, value: ExistingPart) => {
      const list = map.get(key) || [];
      list.push(value);
      map.set(key, list);
    };

    const exactMap = new Map<string, ExistingPart[]>();
    const looseMap = new Map<string, ExistingPart[]>();

    existingParts.forEach((p) => {
      addToMap(exactMap, partKeyExact(p.part_number), p);
      addToMap(looseMap, partKeyLoose(p.part_number), p);
    });

    const findMatchingPart = (csvPartNumber: string) => {
      const exactMatches = exactMap.get(partKeyExact(csvPartNumber)) || [];
      if (exactMatches.length === 1) return { part: exactMatches[0] };
      if (exactMatches.length > 1) {
        return { error: `Multiple parts match Part # "${csvPartNumber}" (case/space-insensitive).` };
      }

      const looseMatches = looseMap.get(partKeyLoose(csvPartNumber)) || [];
      if (looseMatches.length === 1) return { part: looseMatches[0] };
      if (looseMatches.length > 1) {
        return { error: `Multiple parts loosely match Part # "${csvPartNumber}" (ignoring punctuation).` };
      }

      return { error: 'Part not found in database' };
    };

    const diff: DiffRow[] = parsed.map((csvRow) => {
      const match = findMatchingPart(csvRow.partNumber);
      if (!match.part) {
        return {
          status: 'error' as const,
          csvRow,
          errorMessage: match.error || 'Part not found in database',
        };
      }

      const existingPart = match.part;
      const oldPrice = existingPart.default_sell_price;
      const newPrice = csvRow.price;

      // Check if price actually changes (compare with 2 decimal precision)
      const priceChanged = oldPrice === null || Math.abs((oldPrice || 0) - newPrice) >= 0.01;

      if (!priceChanged) {
        return {
          status: 'unchanged' as const,
          csvRow,
          existingPart,
        };
      }

      return {
        status: 'update' as const,
        csvRow,
        existingPart,
        priceChange: {
          oldValue: oldPrice,
          newValue: newPrice,
        },
      };
    });

    setDiffData(diff);
    setStep('preview');
  };
  // Filtered data
  const filteredDiff = useMemo(() => {
    return diffData.filter(d => {
      const matchSearch = searchTerm === '' ||
        d.csvRow.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.existingPart?.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [diffData, searchTerm, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: diffData.length,
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
      const toUpdate = diffData.filter(d => d.status === 'update' && d.existingPart);
      let updatedCount = 0;
      const batchSize = 50;

      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const batch = toUpdate.slice(i, i + batchSize);
        
        // Update each part's default_sell_price
        for (const item of batch) {
          if (item.existingPart) {
            const { error } = await supabase
              .from('parts')
              .update({ default_sell_price: item.csvRow.price })
              .eq('id', item.existingPart.id);
            
            if (!error) updatedCount++;
          }
        }
      }

      return { updated: updatedCount, skipped: stats.unchanged + stats.error };
    },
    onSuccess: (counts) => {
      setImportedCount(counts);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success(`Import complete: ${counts.updated} prices updated`);
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
      case 'update':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1" />Update</Badge>;
      case 'unchanged':
        return <Badge variant="secondary">Unchanged</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
    }
  };

  const formatPrice = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/parts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Retail Pricing Import</h1>
          <p className="text-muted-foreground">Import retail prices from CSV to update default_sell_price</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'mapping', 'preview', 'confirm', 'complete'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary text-primary-foreground' :
              (['upload', 'mapping', 'preview', 'confirm', 'complete'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-muted text-muted-foreground'
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
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload a CSV file with Product (part number) and Price columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-lg font-medium mb-2">Click to upload or drag and drop</div>
                <div className="text-sm text-muted-foreground mb-4">CSV files only</div>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button>Select CSV File</Button>
              </Label>
            </div>

            <Alert className="mt-4">
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                Expected format: CSV with "Product" (part number) and "Price" (retail price) columns.
                This will update the default_sell_price field for matching parts.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns</CardTitle>
            <CardDescription>
              Map your CSV columns to the required fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TARGET_FIELDS.map(field => (
              <div key={field.value} className="flex items-center gap-4">
                <Label className="w-32">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Select
                  value={columnMapping[field.value] || '__none__'}
                  onValueChange={(val) => setColumnMapping(prev => ({ 
                    ...prev, 
                    [field.value]: val === '__none__' ? '' : val 
                  }))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Not mapped --</SelectItem>
                    {csvHeaders.map((header, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={computeDiff}
                disabled={!columnMapping.part_number || !columnMapping.price}
              >
                Preview Changes
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {/* Sample Data Preview */}
            <div className="mt-6">
              <h4 className="font-medium mb-2">Sample Data Preview</h4>
              <ScrollArea className="h-48 border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvHeaders.map((h, i) => (
                        <TableHead key={i}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Price Changes</CardTitle>
            <CardDescription>
              Review changes before applying. Only "Update" rows will be modified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-500">{stats.update}</div>
                  <div className="text-sm text-muted-foreground">Price Updates</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-gray-500">{stats.unchanged}</div>
                  <div className="text-sm text-muted-foreground">Unchanged</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-destructive">{stats.error}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by part number or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="update">Updates Only</SelectItem>
                  <SelectItem value="unchanged">Unchanged</SelectItem>
                  <SelectItem value="error">Errors Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <ScrollArea className="h-[400px] border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Part #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">New Price</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDiff.map((row, idx) => (
                    <TableRow key={idx} className={row.status === 'error' ? 'bg-destructive/10' : ''}>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="font-mono">{row.csvRow.partNumber}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {row.existingPart?.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.existingPart ? formatPrice(row.existingPart.default_sell_price) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(row.csvRow.price)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.errorMessage || (row.priceChange ? 
                          `${formatPrice(row.priceChange.oldValue)} → ${formatPrice(row.priceChange.newValue)}` : 
                          ''
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination */}
            {filteredDiff.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, filteredDiff.length)} of {filteredDiff.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(currentPage + 1) * PAGE_SIZE >= filteredDiff.length}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={stats.update === 0}
              >
                Continue to Confirm
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">Confirm Import</CardTitle>
            <CardDescription>
              You are about to update {stats.update} part prices. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{stats.update}</strong> prices will be updated.{' '}
                <strong>{stats.unchanged}</strong> parts are unchanged.{' '}
                <strong>{stats.error}</strong> parts had errors and will be skipped.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="confirm-input">Type CONFIRM to proceed</Label>
              <Input
                id="confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="CONFIRM"
                className="max-w-xs mt-2"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('preview')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={confirmText !== 'CONFIRM' || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Apply Price Updates
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
            <CardTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-blue-500">{importedCount.updated}</div>
                  <div className="text-muted-foreground">Prices Updated</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-gray-500">{importedCount.skipped}</div>
                  <div className="text-muted-foreground">Skipped</div>
                </CardContent>
              </Card>
            </div>

            <Button onClick={() => navigate('/inventory/parts')}>
              Return to Parts List
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RetailPricingImportPage;
