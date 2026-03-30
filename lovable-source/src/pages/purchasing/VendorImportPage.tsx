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
  Building2,
} from 'lucide-react';

// Target field mappings for vendors
const TARGET_FIELDS = [
  { value: 'name', label: 'Vendor Name', required: true },
  { value: 'contact_name', label: 'Contact Name' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'ZIP' },
  { value: 'country', label: 'Country' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'is_active', label: 'Active' },
];

interface ParsedRow {
  rowIndex: number;
  name: string;
  contact_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  is_active: boolean;
  raw: Record<string, string>;
}

interface DiffRow {
  status: 'new' | 'update' | 'unchanged' | 'deactivate';
  csvRow: ParsedRow;
  existingVendor?: {
    id: string;
    name: string;
    contact_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    is_active: boolean;
  };
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'confirm' | 'complete';

const VendorImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importStats, setImportStats] = useState({ created: 0, updated: 0, deactivated: 0 });

  // Fetch existing vendors
  const { data: existingVendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, contact_name, address, city, state, zip, country, phone, email, website, is_active');
      if (error) throw error;
      return data;
    },
  });

  // Parse CSV with proper handling of quoted fields
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField.trim());
          if (currentRow.some(f => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          if (char === '\r') i++;
        } else if (char !== '\r') {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Auto-detect column mappings based on header names
  const autoDetectMappings = (headers: string[]) => {
    const mappings: Record<string, string> = {};
    const headerMap: Record<string, string[]> = {
      name: ['Name', 'VendorName', 'Vendor Name', 'Company', 'CompanyName'],
      contact_name: ['AddressContact', 'Contact', 'ContactName', 'Contact Name'],
      address: ['Address', 'Street', 'StreetAddress'],
      city: ['City'],
      state: ['State', 'Province'],
      zip: ['Zip', 'ZIP', 'ZipCode', 'Postal', 'PostalCode'],
      country: ['Country'],
      phone: ['Main', 'Phone', 'MainPhone', 'Work'],
      email: ['Email', 'EmailAddress'],
      website: ['Web', 'Website', 'URL'],
      is_active: ['Active', 'IsActive', 'Status'],
    };

    for (const [field, patterns] of Object.entries(headerMap)) {
      for (const header of headers) {
        if (patterns.some(p => header.toLowerCase() === p.toLowerCase())) {
          mappings[field] = header;
          break;
        }
      }
    }

    return mappings;
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast.error('CSV file must have at least a header row and one data row');
        return;
      }

      const headers = rows[0];
      const data = rows.slice(1);

      setCsvHeaders(headers);
      setCsvData(data);
      setColumnMapping(autoDetectMappings(headers));
      setStep('mapping');
      toast.success(`Loaded ${data.length} rows from CSV`);
    };
    reader.readAsText(file);
  };

  // Parse boolean value
  const parseBoolean = (value: string): boolean => {
    const lowered = value.toLowerCase().trim();
    return lowered === 'true' || lowered === 'yes' || lowered === '1' || lowered === 'active';
  };

  // Clean "None" values
  const cleanValue = (value: string): string => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'none') return '';
    return trimmed;
  };

  // Parse rows using current mapping
  const parseMappedRows = (): ParsedRow[] => {
    return csvData.map((row, index) => {
      const getValue = (field: string): string => {
        const header = columnMapping[field];
        if (!header) return '';
        const idx = csvHeaders.indexOf(header);
        return idx >= 0 ? cleanValue(row[idx] || '') : '';
      };

      return {
        rowIndex: index + 2, // +2 for 1-indexed and header row
        name: getValue('name'),
        contact_name: getValue('contact_name'),
        address: getValue('address'),
        city: getValue('city'),
        state: getValue('state'),
        zip: getValue('zip'),
        country: getValue('country'),
        phone: getValue('phone'),
        email: getValue('email'),
        website: getValue('website'),
        is_active: columnMapping['is_active'] ? parseBoolean(getValue('is_active')) : true,
        raw: csvHeaders.reduce((acc, h, i) => ({ ...acc, [h]: row[i] || '' }), {}),
      };
    });
  };

  // Generate diff between CSV and existing vendors
  const generateDiff = () => {
    const parsedRows = parseMappedRows();
    const vendorMap = new Map(
      existingVendors.map(v => [v.name.toLowerCase().trim(), v])
    );

    const diff: DiffRow[] = parsedRows
      .filter(row => row.name) // Skip rows without a name
      .map(csvRow => {
        const existingVendor = vendorMap.get(csvRow.name.toLowerCase().trim());

        if (!existingVendor) {
          return {
            status: 'new' as const,
            csvRow,
          };
        }

        // Compare fields
        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        const fieldsToCompare = [
          { key: 'contact_name', label: 'Contact' },
          { key: 'address', label: 'Address' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'zip', label: 'ZIP' },
          { key: 'country', label: 'Country' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'website', label: 'Website' },
          { key: 'is_active', label: 'Active' },
        ];

        for (const { key, label } of fieldsToCompare) {
          const oldVal = existingVendor[key as keyof typeof existingVendor];
          const newVal = csvRow[key as keyof typeof csvRow];
          
          const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
          const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
          
          if (oldStr !== newStr && (oldStr || newStr)) {
            changes.push({ field: label, oldValue: oldStr, newValue: newStr });
          }
        }

        if (changes.length === 0) {
          return {
            status: 'unchanged' as const,
            csvRow,
            existingVendor,
          };
        }

        // Check for deactivation
        if (!csvRow.is_active && existingVendor.is_active) {
          return {
            status: 'deactivate' as const,
            csvRow,
            existingVendor,
            changes,
          };
        }

        return {
          status: 'update' as const,
          csvRow,
          existingVendor,
          changes,
        };
      });

    setDiffRows(diff);
    setStep('preview');
  };

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    return diffRows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        return (
          row.csvRow.name.toLowerCase().includes(search) ||
          row.csvRow.contact_name.toLowerCase().includes(search) ||
          row.csvRow.email.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [diffRows, statusFilter, searchFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: diffRows.length,
    new: diffRows.filter(r => r.status === 'new').length,
    update: diffRows.filter(r => r.status === 'update').length,
    unchanged: diffRows.filter(r => r.status === 'unchanged').length,
    deactivate: diffRows.filter(r => r.status === 'deactivate').length,
  }), [diffRows]);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const rowsToProcess = diffRows.filter(r => r.status !== 'unchanged');
      let created = 0;
      let updated = 0;
      let deactivated = 0;

      // Batch upserts
      const BATCH_SIZE = 50;
      for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
        const batch = rowsToProcess.slice(i, i + BATCH_SIZE);
        
        for (const row of batch) {
          const vendorData = {
            name: row.csvRow.name,
            contact_name: row.csvRow.contact_name || null,
            address: row.csvRow.address || null,
            city: row.csvRow.city || null,
            state: row.csvRow.state || null,
            zip: row.csvRow.zip || null,
            country: row.csvRow.country || null,
            phone: row.csvRow.phone || null,
            email: row.csvRow.email || null,
            website: row.csvRow.website || null,
            is_active: row.csvRow.is_active,
          };

          if (row.status === 'new') {
            const { error } = await supabase
              .from('vendors')
              .insert(vendorData);
            if (error) throw error;
            created++;
          } else if (row.status === 'update' || row.status === 'deactivate') {
            const { error } = await supabase
              .from('vendors')
              .update(vendorData)
              .eq('id', row.existingVendor!.id);
            if (error) throw error;
            if (row.status === 'deactivate') {
              deactivated++;
            } else {
              updated++;
            }
          }
        }
      }

      return { created, updated, deactivated };
    },
    onSuccess: (result) => {
      setImportStats(result);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setStep('complete');
      toast.success('Vendor import completed successfully');
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Status badge component
  const StatusBadge = ({ status }: { status: DiffRow['status'] }) => {
    const config = {
      new: { variant: 'default' as const, icon: Plus, label: 'NEW', className: 'bg-green-600' },
      update: { variant: 'secondary' as const, icon: RefreshCw, label: 'UPDATE', className: 'bg-blue-600 text-white' },
      unchanged: { variant: 'outline' as const, icon: null, label: 'UNCHANGED', className: '' },
      deactivate: { variant: 'destructive' as const, icon: Minus, label: 'DEACTIVATE', className: '' },
    };
    const { variant, icon: Icon, label, className } = config[status];
    return (
      <Badge variant={variant} className={className}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {label}
      </Badge>
    );
  };

  // Render steps
  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Vendor CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file exported from Fishbowl or another system with vendor data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <label className="border-2 border-dashed border-muted rounded-lg p-8 text-center block cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Drag and drop a CSV file, or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
        </label>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Expected columns:</strong> Name, AddressContact, Address, City, State, Zip, Country, 
            Main (phone), Email, Web, Active
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );

  const renderMappingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Map CSV Columns</CardTitle>
        <CardDescription>
          Map your CSV columns to vendor fields. Required fields are marked with *.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('upload')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={generateDiff}
            disabled={!columnMapping['name']}
          >
            Preview Changes
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderPreviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Preview Changes</CardTitle>
        <CardDescription>
          Review the changes that will be made to your vendor list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center bg-green-50 dark:bg-green-900/20">
            <p className="text-2xl font-bold text-green-600">{stats.new}</p>
            <p className="text-xs text-muted-foreground">New</p>
          </Card>
          <Card className="p-3 text-center bg-blue-50 dark:bg-blue-900/20">
            <p className="text-2xl font-bold text-blue-600">{stats.update}</p>
            <p className="text-xs text-muted-foreground">Updates</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.unchanged}</p>
            <p className="text-xs text-muted-foreground">Unchanged</p>
          </Card>
          <Card className="p-3 text-center bg-red-50 dark:bg-red-900/20">
            <p className="text-2xl font-bold text-red-600">{stats.deactivate}</p>
            <p className="text-xs text-muted-foreground">Deactivate</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
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
        <ScrollArea className="h-[400px] border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="font-medium">{row.csvRow.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {row.csvRow.contact_name && <p>{row.csvRow.contact_name}</p>}
                      {row.csvRow.email && <p className="text-muted-foreground">{row.csvRow.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {[row.csvRow.city, row.csvRow.state].filter(Boolean).join(', ') || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.changes && row.changes.length > 0 ? (
                      <div className="text-xs space-y-1">
                        {row.changes.slice(0, 3).map((change, i) => (
                          <div key={i}>
                            <span className="text-muted-foreground">{change.field}:</span>{' '}
                            <span className="line-through text-red-500">{change.oldValue || '(empty)'}</span>{' '}
                            → <span className="text-green-600">{change.newValue || '(empty)'}</span>
                          </div>
                        ))}
                        {row.changes.length > 3 && (
                          <span className="text-muted-foreground">+{row.changes.length - 3} more</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('mapping')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={() => setStep('confirm')}
            disabled={stats.new + stats.update + stats.deactivate === 0}
          >
            Continue to Confirm
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderConfirmStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Import</CardTitle>
        <CardDescription>
          This action will modify your vendor database. Please confirm to proceed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This will create {stats.new} new vendors, 
            update {stats.update} existing vendors, and deactivate {stats.deactivate} vendors.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Type CONFIRM to proceed</Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type CONFIRM..."
          />
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('preview')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={() => importMutation.mutate()}
            disabled={confirmText !== 'CONFIRM' || importMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import Vendors
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCompleteStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-6 w-6" />
          Import Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center bg-green-50 dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600">{importStats.created}</p>
            <p className="text-sm text-muted-foreground">Created</p>
          </Card>
          <Card className="p-4 text-center bg-blue-50 dark:bg-blue-900/20">
            <p className="text-3xl font-bold text-blue-600">{importStats.updated}</p>
            <p className="text-sm text-muted-foreground">Updated</p>
          </Card>
          <Card className="p-4 text-center bg-red-50 dark:bg-red-900/20">
            <p className="text-3xl font-bold text-red-600">{importStats.deactivated}</p>
            <p className="text-sm text-muted-foreground">Deactivated</p>
          </Card>
        </div>

        <Button className="w-full" onClick={() => navigate('/purchasing/vendors')}>
          <Building2 className="h-4 w-4 mr-2" />
          Go to Vendors
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Vendor CSV Import</h1>
          <p className="text-muted-foreground">Import vendors from Fishbowl or another CSV source</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/purchasing/vendors')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Vendors
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'mapping', 'preview', 'confirm', 'complete'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`
              h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium
              ${step === s ? 'bg-primary text-primary-foreground' : 
                ['upload', 'mapping', 'preview', 'confirm', 'complete'].indexOf(step) > i 
                  ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}
            `}>
              {i + 1}
            </div>
            {i < 4 && <div className="w-8 h-0.5 bg-muted mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'upload' && renderUploadStep()}
      {step === 'mapping' && renderMappingStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'confirm' && renderConfirmStep()}
      {step === 'complete' && renderCompleteStep()}
    </div>
  );
};

export default VendorImportPage;
