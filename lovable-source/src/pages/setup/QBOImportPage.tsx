import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Package,
  Wrench,
  Box,
  Watch,
  Shield,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';

// Regex patterns to detect client watch entries:
// 1. Job number pattern (E##### or T####) at end of description
// 2. Date pattern (M/D/YY or M-D-YY) at start of description
const CLIENT_WATCH_JOB_PATTERN = /[ET]\d{4,6}\s*$/i;
const CLIENT_WATCH_DATE_PATTERN = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s/;
const isClientWatch = (description: string): boolean => {
  return CLIENT_WATCH_JOB_PATTERN.test(description) || CLIENT_WATCH_DATE_PATTERN.test(description);
};

interface ParsedRow {
  name: string;
  variantName: string;
  qtyOnHand: number;
  itemType: string;
  singleParentVariant: string;
  category: string;
  sku: string;
  taxable: boolean;
  price: number;
  cost: number;
  incomeAccount: string;
  expenseAccount: string;
  inventoryAssetAccount: string;
  salesDescription: string;
  purchaseDescription: string;
  reorderPoint: number;
  // Computed
  mappedItemType: 'inventory' | 'non_inventory' | 'service' | 'client_watch';
  partNumber: string;
  description: string;
  selected: boolean;
  serviceCodeId?: string; // Optional mapping to service_subcategories
  error?: string;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  service_code: string;
  category_id: string;
}

type Step = 'upload' | 'preview' | 'confirm' | 'complete';

type ParseDiagnostics = {
  totalRows: number;
  headerRowIndex: number;
  dataRows: number;
  parsedItems: number;
  skippedEmpty: number;
  skippedDupe: number;
  skippedParent: number;
  headersPreview: string[];
};

const QBOImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();

  // Permission check
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessSetup) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [step, setStep] = useState<Step>('upload');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [confirmText, setConfirmText] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [parseDiagnostics, setParseDiagnostics] = useState<ParseDiagnostics | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 100;

  // Fetch service subcategories for mapping dropdown
  const { data: serviceSubcategories = [] } = useQuery<ServiceSubcategory[]>({
    queryKey: ['service-subcategories-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_subcategories')
        .select('id, name, service_code, category_id')
        .eq('is_active', true)
        .order('service_code');
      if (error) throw error;
      return data || [];
    },
  });

  // Parse CSV file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Helper to find header index with flexible matching
  const findHeader = (headerMap: Record<string, number>, ...options: string[]): number => {
    for (const opt of options) {
      if (headerMap[opt] !== undefined) return headerMap[opt];
    }
    return -1;
  };

  // Robust CSV parser (handles commas, quotes, and newlines inside quoted fields)
  const parseCSVText = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    const pushCell = () => {
      // Normalize embedded newlines to spaces so preview + pattern matching behave predictably
      row.push(cell.replace(/\r?\n/g, ' ').trim());
      cell = '';
    };

    const pushRow = () => {
      rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        // Escaped quotes inside quoted fields
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

        // Swallow Windows line ending (\r\n)
        if (char === '\r' && text[i + 1] === '\n') i++;
        continue;
      }

      cell += char;
    }

    // Final cell / row
    pushCell();
    if (row.some((v) => v !== '')) {
      pushRow();
    }

    // Drop trailing empty rows
    while (rows.length > 0 && rows[rows.length - 1].every((v) => v === '')) {
      rows.pop();
    }

    return rows;
  };

  const parseCSV = (text: string) => {
    const rows = parseCSVText(text);

    console.log(`Total rows in file (incl. headers): ${rows.length}`);

    if (rows.length < 2) {
      toast.error('CSV file appears to be empty');
      return;
    }

    // Find the header row (some exports include an initial "sep=," line or a few preamble lines)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const candidate = rows[i];
      if (candidate.length === 1 && /^sep\s*=/.test(candidate[0].toLowerCase().trim())) {
        continue;
      }

      const candidateMap: Record<string, number> = {};
      candidate.forEach((h, idx) => {
        const normalized = h.replace(/^\uFEFF/, '').toLowerCase().trim();
        if (normalized) candidateMap[normalized] = idx;
      });

      const candidateNameIdx = findHeader(
        candidateMap,
        'product/service name',
        'name',
        'item name',
        'product name',
        'productname'
      );

      if (candidateNameIdx !== -1) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = rows[headerRowIndex].map((h) => h.replace(/^\uFEFF/, ''));

    // Map header indices (normalize to lowercase)
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    // Log detected headers for debugging
    console.log('Detected CSV headers:', Object.keys(headerMap));

    // Flexible header indices
    const nameIdx = findHeader(headerMap, 'product/service name', 'name', 'item name', 'product name', 'productname');
    const variantIdx = findHeader(headerMap, 'variant name', 'variantname');
    const itemTypeIdx = findHeader(headerMap, 'item type', 'type', 'itemtype');
    const singleParentVariantIdx = findHeader(headerMap, 'single,parent or variant?', 'single, parent or variant?', 'variant type');
    const skuIdx = findHeader(headerMap, 'sku', 'item sku', 'product sku');
    const salesDescIdx = findHeader(headerMap, 'sales description', 'description', 'salesdescription');
    const purchaseDescIdx = findHeader(headerMap, 'purchase description', 'purchasedescription');
    const categoryIdx = findHeader(headerMap, 'category', 'product category');
    const priceIdx = findHeader(headerMap, 'price', 'sales price', 'salesprice', 'rate');
    const costIdx = findHeader(headerMap, 'cost', 'purchase cost', 'purchasecost', 'avg cost');
    const taxableIdx = findHeader(headerMap, 'taxable', 'is taxable');
    const qtyIdx = findHeader(headerMap, 'quantity on hand', 'qty on hand', 'qty', 'quantity');
    const reorderIdx = findHeader(headerMap, 'reorder point', 'reorderpoint', 'min qty');
    const incomeAcctIdx = findHeader(headerMap, 'income account', 'incomeaccount', 'sales account');
    const expenseAcctIdx = findHeader(headerMap, 'expense account', 'expenseaccount', 'cogs account');
    const assetAcctIdx = findHeader(headerMap, 'inventory asset account', 'asset account');

    console.log('Header indices found:', { nameIdx, variantIdx, itemTypeIdx, singleParentVariantIdx, skuIdx, priceIdx, costIdx });

    if (nameIdx === -1) {
      toast.error('Could not find product name column.');
      console.error('All headers:', Object.keys(headerMap));
      return;
    }

    const dataStartRow = headerRowIndex + 1;

    const parsed: ParsedRow[] = [];
    const seenKeys = new Set<string>();
    let skippedEmpty = 0;
    let skippedDupe = 0;
    let skippedParent = 0;

    for (let i = dataStartRow; i < rows.length; i++) {
      const values = rows[i];

      // Skip empty rows
      if (!values || values.length === 0 || values.every((v) => !v)) {
        skippedEmpty++;
        continue;
      }

      const name = (nameIdx >= 0 ? values[nameIdx] : '') || '';
      const variantName = (variantIdx >= 0 ? values[variantIdx] : '') || '';
      const itemTypeRaw = (itemTypeIdx >= 0 ? values[itemTypeIdx] : '') || '';
      const itemType = itemTypeRaw.toLowerCase();
      const singleParentVariant = ((singleParentVariantIdx >= 0 ? values[singleParentVariantIdx] : '') || '').toLowerCase();

      // Skip empty names
      if (!name) {
        skippedEmpty++;
        continue;
      }

      // Skip "Parent" items - we only want Single or Variant items with actual data
      if (singleParentVariant === 'parent') {
        skippedParent++;
        continue;
      }

      // Create unique key combining name + variant
      const uniqueKey = variantName ? `${name}::${variantName}` : name;

      // Skip duplicates (QBO exports can have dupes)
      if (seenKeys.has(uniqueKey)) {
        skippedDupe++;
        continue;
      }
      seenKeys.add(uniqueKey);

      // Determine part number and description first (needed for client watch detection)
      const sku = (skuIdx >= 0 ? values[skuIdx] : '') || '';
      const salesDesc = (salesDescIdx >= 0 ? values[salesDescIdx] : '') || '';
      const purchaseDesc = (purchaseDescIdx >= 0 ? values[purchaseDescIdx] : '') || '';

      // Build full name including variant
      const fullName = variantName ? `${name} - ${variantName}` : name;
      const description = salesDesc || purchaseDesc || fullName;

      // Map item type - detect client watches by E##### pattern in description
      let mappedItemType: 'inventory' | 'non_inventory' | 'service' | 'client_watch' = 'service';
      if (itemType === 'inventory') {
        mappedItemType = 'inventory';
      } else if (itemType === 'non-inventory') {
        mappedItemType = 'non_inventory';
      } else if (itemType === 'service' && isClientWatch(description)) {
        // Service items with E##### job number pattern are client watches
        mappedItemType = 'client_watch';
      }

      parsed.push({
        name: fullName,
        variantName,
        qtyOnHand: qtyIdx >= 0 ? (parseFloat(values[qtyIdx]) || 0) : 0,
        itemType: itemTypeIdx >= 0 ? values[itemTypeIdx] : '',
        singleParentVariant,
        category: categoryIdx >= 0 ? values[categoryIdx] : '',
        sku,
        taxable: taxableIdx >= 0 ? values[taxableIdx]?.toLowerCase() === 'yes' : false,
        price: priceIdx >= 0 ? (parseFloat(values[priceIdx]) || 0) : 0,
        cost: costIdx >= 0 ? (parseFloat(values[costIdx]) || 0) : 0,
        incomeAccount: incomeAcctIdx >= 0 ? values[incomeAcctIdx] : '',
        expenseAccount: expenseAcctIdx >= 0 ? values[expenseAcctIdx] : '',
        inventoryAssetAccount: assetAcctIdx >= 0 ? values[assetAcctIdx] : '',
        salesDescription: salesDesc,
        purchaseDescription: purchaseDesc,
        reorderPoint: reorderIdx >= 0 ? (parseFloat(values[reorderIdx]) || 0) : 0,
        // Computed
        mappedItemType,
        partNumber: sku || fullName,
        description,
        // Pre-select inventory and non-inventory; skip client watches and services by default
        selected: mappedItemType === 'inventory' || mappedItemType === 'non_inventory',
      });
    }

    console.log('Parsing complete:', {
      rawRows: rows.length - dataStartRow,
      parsed: parsed.length,
      skippedEmpty,
      skippedDupe,
      skippedParent,
    });

    setParsedData(parsed);
    setStep('preview');
    toast.success(
      `Parsed ${parsed.length} items from ${rows.length - dataStartRow} CSV rows (${skippedParent} parent items, ${skippedDupe} duplicates skipped)`
    );
  };

  // Filter data based on search and item type
  const filteredData = useMemo(() => {
    return parsedData.filter(row => {
      const matchesSearch = !searchTerm || 
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = itemTypeFilter === 'all' || row.mappedItemType === itemTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [parsedData, searchTerm, itemTypeFilter]);

  // Stats
  const stats = useMemo(() => {
    const selected = parsedData.filter(r => r.selected);
    return {
      total: parsedData.length,
      selected: selected.length,
      inventory: parsedData.filter(r => r.mappedItemType === 'inventory').length,
      nonInventory: parsedData.filter(r => r.mappedItemType === 'non_inventory').length,
      service: parsedData.filter(r => r.mappedItemType === 'service').length,
      clientWatch: parsedData.filter(r => r.mappedItemType === 'client_watch').length,
      selectedInventory: selected.filter(r => r.mappedItemType === 'inventory').length,
      selectedNonInventory: selected.filter(r => r.mappedItemType === 'non_inventory').length,
      selectedService: selected.filter(r => r.mappedItemType === 'service').length,
      selectedClientWatch: selected.filter(r => r.mappedItemType === 'client_watch').length,
    };
  }, [parsedData]);

  // Toggle selection
  const toggleSelection = (index: number) => {
    setParsedData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  // Update service code mapping for a row
  const updateServiceCode = (index: number, serviceCodeId: string | undefined) => {
    setParsedData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], serviceCodeId };
      return updated;
    });
  };

  // Select all filtered
  const selectAllFiltered = (selected: boolean) => {
    const filteredNames = new Set(filteredData.map(r => r.name));
    setParsedData(prev => prev.map(row => 
      filteredNames.has(row.name) ? { ...row, selected } : row
    ));
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedItems = parsedData.filter(r => r.selected);
      let imported = 0;
      const batchSize = 50;

      for (let i = 0; i < selectedItems.length; i += batchSize) {
        const batch = selectedItems.slice(i, i + batchSize);
        
        const { error } = await supabase.from('parts').upsert(
          batch.map(item => ({
            part_number: item.partNumber,
            description: item.description,
            item_type: item.mappedItemType,
            category: item.category || null,
            default_sell_price: item.price || null,
            last_cost: item.cost || null,
            average_cost: item.cost || null,
            reorder_point: item.reorderPoint || null,
            qbo_income_account: item.incomeAccount || null,
            qbo_cogs_account: item.expenseAccount || null,
            qbo_asset_account: item.inventoryAssetAccount || null,
            notes: item.purchaseDescription || null,
            is_active: true,
          })),
          { onConflict: 'part_number', ignoreDuplicates: false }
        );

        if (error) throw error;
        imported += batch.length;
      }

      return imported;
    },
    onSuccess: (count) => {
      setImportedCount(count);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success(`Successfully imported ${count} items`);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-serif font-semibold">Import from QuickBooks</h1>
          <p className="text-muted-foreground">Import products and services from a QBO export</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['upload', 'preview', 'confirm', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary text-primary-foreground' : 
              ['upload', 'preview', 'confirm', 'complete'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 
              'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload QBO Export
            </CardTitle>
            <CardDescription>
              Export your Products and Services list from QuickBooks Online and upload the CSV file here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">CSV file exported from QuickBooks Online</p>
                </div>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </Label>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>How to export from QBO:</strong> Go to Sales → Products and Services → 
                click the gear icon → Export to Excel/CSV
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stats.inventory}</p>
                    <p className="text-sm text-muted-foreground">Inventory</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Box className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stats.nonInventory}</p>
                    <p className="text-sm text-muted-foreground">Non-Inventory</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stats.service}</p>
                    <p className="text-sm text-muted-foreground">Service</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Watch className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stats.clientWatch}</p>
                    <p className="text-sm text-muted-foreground">Client Watches</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="non_inventory">Non-Inventory</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="client_watch">Client Watch</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => selectAllFiltered(true)}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectAllFiltered(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
              <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Service Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((row, idx) => {
                      const originalIdx = parsedData.findIndex(r => r.name === row.name);
                      const isServiceType = row.mappedItemType === 'service';
                      return (
                        <TableRow key={row.name} className={row.selected ? '' : 'opacity-50'}>
                          <TableCell>
                            <Checkbox
                              checked={row.selected}
                              onCheckedChange={() => toggleSelection(originalIdx)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.partNumber}</TableCell>
                          <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                          <TableCell>
                            <Badge variant={
                              row.mappedItemType === 'inventory' ? 'default' :
                              row.mappedItemType === 'non_inventory' ? 'secondary' :
                              row.mappedItemType === 'client_watch' ? 'outline' : 'outline'
                            } className={row.mappedItemType === 'client_watch' ? 'border-amber-500 text-amber-700' : ''}>
                              {row.mappedItemType === 'non_inventory' ? 'Non-Inv' : 
                               row.mappedItemType === 'client_watch' ? 'Client Watch' : row.mappedItemType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isServiceType ? (
                              <Select
                                value={row.serviceCodeId || 'none'}
                                onValueChange={(value) => updateServiceCode(originalIdx, value === 'none' ? undefined : value)}
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue placeholder="Map..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {serviceSubcategories.map(sc => (
                                    <SelectItem key={sc.id} value={sc.id}>
                                      <span className="font-mono">{sc.service_code}</span>
                                      <span className="ml-2 text-muted-foreground">{sc.name}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>{row.category || '-'}</TableCell>
                          <TableCell className="text-right">
                            {row.price ? `$${row.price.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.cost ? `$${row.cost.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredData.length > PAGE_SIZE && (
                <div className="p-3 flex items-center justify-between border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, filteredData.length)} of {filteredData.length} items
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {Math.ceil(filteredData.length / PAGE_SIZE)}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={(currentPage + 1) * PAGE_SIZE >= filteredData.length}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {stats.selected} items selected for import
              </span>
              <Button onClick={() => setStep('confirm')} disabled={stats.selected === 0}>
                Continue to Import
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Import
            </CardTitle>
            <CardDescription>
              Review the import summary and type CONFIRM to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Inventory Items</p>
                <p className="text-2xl font-semibold">{stats.selectedInventory}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Non-Inventory Items</p>
                <p className="text-2xl font-semibold">{stats.selectedNonInventory}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Service Items</p>
                <p className="text-2xl font-semibold">{stats.selectedService}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Client Watches</p>
                <p className="text-2xl font-semibold">{stats.selectedClientWatch}</p>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>This will create or update {stats.selected} parts</strong> in the database. 
                Existing parts with matching part numbers will be updated.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-input">Type CONFIRM to proceed</Label>
              <Input
                id="confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="CONFIRM"
                className="max-w-xs"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
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
                    Import {stats.selected} Items
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold">Import Complete!</h2>
            <p className="text-muted-foreground">
              Successfully imported {importedCount} products and services.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => navigate('/inventory/products')}>
                View Products
              </Button>
              <Button onClick={() => navigate('/inventory/parts')}>
                Go to Parts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QBOImportPage;
