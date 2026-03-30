import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Printer,
  Download,
  Upload,
  Users,
  Trash2,
  Pencil,
  Merge,
  Plus,
} from 'lucide-react';
import { CustomerSidePanel } from '@/components/customers';
import { CustomerCSVInstructionsDialog } from '@/components/customers/CustomerCSVInstructionsDialog';
import { Customer } from '@/types/database';
import { toast } from 'sonner';

type ImportPreview = {
  updates: { id: string; display_name: string; changes: string[]; action: 'update' | 'create' }[];
  totalRecords: number;
  updateCount: number;
  createCount: number;
  unchangedCount: number;
  rawData: any[];
};

export default function CustomersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [isCustomerPanelOpen, setIsCustomerPanelOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [nameSortAsc, setNameSortAsc] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Handle opening customer from URL param (for global search)
  const customerId = searchParams.get('id');
  const viewMode = searchParams.get('view'); // 'history' or null
  const isNewCustomer = searchParams.get('new') === 'true';
  const prefillName = searchParams.get('name');
  
  const { data: urlCustomer } = useQuery({
    queryKey: ['customer-by-id', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Open panel when customer is loaded from URL
  useEffect(() => {
    if (urlCustomer && !isCustomerPanelOpen) {
      setEditingCustomer(urlCustomer as Customer);
      setIsCustomerPanelOpen(true);
    }
  }, [urlCustomer]);

  // Track prefilled name for new customer form
  const [initialSearchText, setInitialSearchText] = useState<string>('');

  // Open new customer panel with prefilled name from URL
  useEffect(() => {
    if (isNewCustomer && !isCustomerPanelOpen) {
      // Set the prefill name for the CustomerSidePanel
      setInitialSearchText(prefillName || '');
      setEditingCustomer(null); // null = new customer, not editing
      setIsCustomerPanelOpen(true);
      // Clear URL params after opening
      setSearchParams({});
    }
  }, [isNewCustomer, prefillName]);

  // Clear URL param when panel closes
  const handlePanelClose = (open: boolean) => {
    setIsCustomerPanelOpen(open);
    if (!open) {
      setEditingCustomer(null);
      setInitialSearchText(''); // Reset prefill text
      if (customerId || isNewCustomer) {
        setSearchParams({});
      }
    }
  };

  // Get search terms from query
  const getSearchTerms = (query: string) => {
    return query.trim().split(/\s+/).filter(t => t.length > 0);
  };

  // Build OR filter for a single term - use starts-with for names, contains for email/phone
  const buildTermFilter = (term: string) => {
    // Names: match at START of field for precision
    // Email/phone: only search if term looks relevant
    const hasDigits = /\d/.test(term);
    const looksLikeEmail = term.includes('@') || term.includes('.');
    
    const conditions = [
      `first_name.ilike.${term}%`,      // starts with
      `last_name.ilike.${term}%`,       // starts with
      `display_name.ilike.${term}%`,    // starts with
      `company_name.ilike.${term}%`,    // starts with
    ];
    
    // Only search email if it looks like email content
    if (looksLikeEmail || term.length >= 3) {
      conditions.push(`email.ilike.%${term}%`);
    }
    
    // Only search phone fields if term has digits
    if (hasDigits) {
      conditions.push(`phone.ilike.%${term}%`);
      conditions.push(`phone_normalized.ilike.%${term}%`);
    }
    
    return conditions.join(',');
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customers-list', searchQuery, page, nameSortAsc],
    queryFn: async () => {
      const terms = getSearchTerms(searchQuery);
      
      // First get total count
      let countQuery = supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });
      
      // Apply each term as a separate .or() - multiple .or() calls are ANDed together
      // This means ALL terms must match (in any field)
      for (const term of terms) {
        countQuery = countQuery.or(buildTermFilter(term));
      }
      
      const { count } = await countQuery;

      // Then get paginated data
      let query = supabase
        .from('customers')
        .select('*')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      // Apply each term filter - ALL terms must match
      for (const term of terms) {
        query = query.or(buildTermFilter(term));
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Sort client-side for case-insensitive alphabetical ordering
      const sortedData = (data || []).sort((a, b) => {
        const lastNameA = (a.last_name || '').toLowerCase();
        const lastNameB = (b.last_name || '').toLowerCase();
        if (lastNameA !== lastNameB) {
          return nameSortAsc 
            ? lastNameA.localeCompare(lastNameB)
            : lastNameB.localeCompare(lastNameA);
        }
        const firstNameA = (a.first_name || '').toLowerCase();
        const firstNameB = (b.first_name || '').toLowerCase();
        return nameSortAsc 
          ? firstNameA.localeCompare(firstNameB)
          : firstNameB.localeCompare(firstNameA);
      });
      
      return { customers: sortedData, totalCount: count || 0 };
    },
  });

  const customers = data?.customers || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startIndex = page * PAGE_SIZE + 1;
  const endIndex = Math.min((page + 1) * PAGE_SIZE, totalCount);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === customers?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers?.map((c: any) => c.id) || []));
    }
  };

  const getDisplayName = (customer: any) => {
    if (customer?.first_name || customer?.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    if (customer?.display_name) return customer.display_name;
    return '—';
  };

  const getCompanyInfo = (customer: any) => {
    return customer?.company_name || '—';
  };

  const handleCreateEstimate = (customerId: string) => {
    navigate(`/estimates/new?customer_id=${customerId}`);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerPanelOpen(true);
  };

  const handleCustomerSaved = () => {
    setIsCustomerPanelOpen(false);
    setEditingCustomer(null);
    refetch();
  };

  const handleEditSelected = () => {
    if (selectedIds.size !== 1) return;
    const customerId = Array.from(selectedIds)[0];
    const customer = customers?.find((c: any) => c.id === customerId);
    if (customer) {
      handleEditCustomer(customer as Customer);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const customerIds = Array.from(selectedIds);

    try {
      // First, get all watches for these customers
      const { data: watches } = await supabase
        .from('watches')
        .select('id')
        .in('customer_id', customerIds);
      
      const watchIds = watches?.map(w => w.id) || [];

      // Get all jobs for these customers
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .in('customer_id', customerIds);
      
      const jobIds = jobs?.map(j => j.id) || [];

      // Delete in order of dependencies:
      
      // 1. Delete job-related records first
      if (jobIds.length > 0) {
        await supabase.from('job_activity_log').delete().in('job_id', jobIds);
        await supabase.from('job_status_history').delete().in('job_id', jobIds);
        await supabase.from('line_items').delete().in('job_id', jobIds);
        await supabase.from('timing_tests').delete().in('job_id', jobIds);
        await supabase.from('pressure_tests').delete().in('job_id', jobIds);
        await supabase.from('attachments').delete().in('job_id', jobIds);
      }

      // 2. Delete intake_leads
      await supabase.from('intake_leads').delete().in('customer_id', customerIds);

      // 3. Delete client_property
      await supabase.from('client_property').delete().in('customer_id', customerIds);

      // 4. Delete estimates and their line items
      const { data: estimates } = await supabase
        .from('estimates')
        .select('id')
        .in('customer_id', customerIds);
      
      const estimateIds = estimates?.map(e => e.id) || [];
      if (estimateIds.length > 0) {
        await supabase.from('estimate_line_items').delete().in('estimate_id', estimateIds);
        await supabase.from('estimates').delete().in('id', estimateIds);
      }

      // 5. Delete jobs
      if (jobIds.length > 0) {
        await supabase.from('jobs').delete().in('id', jobIds);
      }

      // 6. Delete watches
      if (watchIds.length > 0) {
        await supabase.from('watches').delete().in('id', watchIds);
      }

      // 7. Delete customer addresses and communication permissions
      await supabase.from('customer_addresses').delete().in('customer_id', customerIds);
      await supabase.from('customer_communication_permissions').delete().in('customer_id', customerIds);

      // 8. Finally delete customers
      const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', customerIds);

      if (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete customers: ${error.message}`);
        return;
      }

      toast.success(`Deleted ${selectedIds.size} customer(s) and related records`);
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleOpenMergeDialog = () => {
    if (selectedIds.size < 2) {
      toast.error('Select at least 2 customers to merge');
      return;
    }
    setPrimaryMergeId(Array.from(selectedIds)[0]);
    setMergeDialogOpen(true);
  };

  const handleMergeCustomers = async () => {
    if (!primaryMergeId || selectedIds.size < 2) return;

    const idsToMerge = Array.from(selectedIds).filter(id => id !== primaryMergeId);

    // Update all jobs to point to primary customer
    const { error: jobsError } = await supabase
      .from('jobs')
      .update({ customer_id: primaryMergeId })
      .in('customer_id', idsToMerge);

    if (jobsError) {
      toast.error('Failed to reassign jobs');
      return;
    }

    // Update all intake_leads to point to primary customer
    await supabase
      .from('intake_leads')
      .update({ customer_id: primaryMergeId })
      .in('customer_id', idsToMerge);

    // Delete merged customers
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .in('id', idsToMerge);

    if (deleteError) {
      toast.error('Failed to delete merged customers');
      return;
    }

    toast.success(`Merged ${selectedIds.size} customers`);
    setSelectedIds(new Set());
    setMergeDialogOpen(false);
    setPrimaryMergeId(null);
    queryClient.invalidateQueries({ queryKey: ['customers-list'] });
  };

  const selectedCustomers = customers?.filter((c: any) => selectedIds.has(c.id)) || [];

  // CSV Parser
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
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    };

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          i++;
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
    if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    return rows;
  };

  // Export CSV
  const exportToCSV = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, display_name, email, phone, mobile_phone, company_name, address, city, state, zip, notes, internal_notes, created_at')
      .order('last_name');

    if (error) {
      toast.error(`Export failed: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['id', 'first_name', 'last_name', 'display_name', 'email', 'phone', 'mobile_phone', 'company_name', 'address', 'city', 'state', 'zip', 'notes', 'internal_notes', 'created_at'];
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
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
    link.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.length} customers`);
  };

  // Import CSV
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.info(`Reading ${file.name}...`);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast.error('CSV must have headers and at least one row');
        return;
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const idIndex = headers.indexOf('id');
      const firstNameIndex = headers.indexOf('first_name');
      const lastNameIndex = headers.indexOf('last_name');

      if (firstNameIndex === -1 || lastNameIndex === -1) {
        toast.error('CSV must have "first_name" and "last_name" columns');
        return;
      }

      // Parse rows into objects
      const parsedRows: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx]?.trim() || null;
        });
        if (obj.first_name || obj.last_name) {
          parsedRows.push(obj);
        }
      }

      if (parsedRows.length === 0) {
        toast.error('No valid customer rows found');
        return;
      }

      // Get existing customers for comparison
      const existingIds = parsedRows.filter(r => r.id).map(r => r.id);
      let existingCustomers: any[] = [];
      
      if (existingIds.length > 0) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .in('id', existingIds);
        existingCustomers = data || [];
      }

      const existingMap = new Map(existingCustomers.map(c => [c.id, c]));
      const updates: ImportPreview['updates'] = [];
      let createCount = 0;
      let updateCount = 0;
      let unchangedCount = 0;

      const compareFields = ['first_name', 'last_name', 'display_name', 'email', 'phone', 'mobile_phone', 'company_name', 'address', 'city', 'state', 'zip', 'notes', 'internal_notes'];

      for (const row of parsedRows) {
        if (row.id && existingMap.has(row.id)) {
          // Check for changes
          const existing = existingMap.get(row.id);
          const changes: string[] = [];
          
          for (const field of compareFields) {
            const newVal = row[field] || '';
            const oldVal = existing[field] || '';
            if (newVal !== oldVal) {
              changes.push(`${field}: "${oldVal}" → "${newVal}"`);
            }
          }

          if (changes.length > 0) {
            updateCount++;
            updates.push({
              id: row.id,
              display_name: row.display_name || `${row.first_name} ${row.last_name}`.trim(),
              changes,
              action: 'update',
            });
          } else {
            unchangedCount++;
          }
        } else {
          // New customer
          createCount++;
          updates.push({
            id: '',
            display_name: row.display_name || `${row.first_name} ${row.last_name}`.trim(),
            changes: ['New customer'],
            action: 'create',
          });
        }
      }

      if (updates.length === 0) {
        toast.info('No changes detected');
        return;
      }

      setImportPreview({
        updates,
        totalRecords: parsedRows.length,
        updateCount,
        createCount,
        unchangedCount,
        rawData: parsedRows,
      });
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  // Commit import
  const commitImport = async () => {
    if (!importPreview) return;

    setIsCommitting(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const row of importPreview.rawData) {
        if (row.id) {
          // Update existing
          const updateData: any = {};
          ['first_name', 'last_name', 'display_name', 'email', 'phone', 'mobile_phone', 'company_name', 'address', 'city', 'state', 'zip', 'notes', 'internal_notes'].forEach(field => {
            if (row[field] !== undefined) {
              updateData[field] = row[field] || null;
            }
          });

          const { error } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', row.id);

          if (error) errorCount++;
          else successCount++;
        } else {
          // Create new
          const { error } = await supabase
            .from('customers')
            .insert({
              first_name: row.first_name,
              last_name: row.last_name,
              display_name: row.display_name || null,
              email: row.email || null,
              phone: row.phone || null,
              mobile_phone: row.mobile_phone || null,
              company_name: row.company_name || null,
              address: row.address || null,
              city: row.city || null,
              state: row.state || null,
              zip: row.zip || null,
              notes: row.notes || null,
              internal_notes: row.internal_notes || null,
            });

          if (error) errorCount++;
          else successCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      setImportPreview(null);
      
      const messages: string[] = [];
      if (successCount > 0) messages.push(`${successCount} processed`);
      if (errorCount > 0) messages.push(`${errorCount} failed`);
      
      toast.success(`Import complete: ${messages.join(', ')}`);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

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
                    <TableCell>Records to be updated</TableCell>
                    <TableCell className="text-right font-medium text-primary">{importPreview?.updateCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>New records to create</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{importPreview?.createCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Records unchanged</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">{importPreview?.unchangedCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Changes Detail */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview?.updates.slice(0, 50).map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{u.display_name}</TableCell>
                      <TableCell>
                        <Badge variant={u.action === 'create' ? 'default' : 'outline'}>
                          {u.action === 'create' ? 'New' : 'Update'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {u.changes.join('; ')}
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
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button onClick={commitImport} disabled={isCommitting}>
              {isCommitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm & Apply {importPreview?.updates.length} Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <div className="min-h-screen bg-[#f3f4f6]">
      {/* QBO-style Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Search */}
          <div className="relative w-80">
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-9 border-slate-300"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          {/* Action Icons or Bulk Actions */}
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 mr-2">{selectedIds.size} selected</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditSelected}
                disabled={selectedIds.size !== 1}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMergeDialog}
                disabled={selectedIds.size < 2}
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                title="Export CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                title="Import CSV"
              >
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import CSV
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <CustomerCSVInstructionsDialog />
              <Button
                size="sm"
                onClick={() => {
                  setEditingCustomer(null);
                  setIsCustomerPanelOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : customers?.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No customers found</p>
              <p className="text-sm">Add customers from the Estimates page</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr className="text-left">
                  <th className="w-12 px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.size === customers?.length && customers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-50"
                    onClick={() => setNameSortAsc(!nameSortAsc)}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {nameSortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Company Name
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-right">
                    <div className="flex items-center justify-end gap-1">
                      Open Balance
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers?.map((customer: any) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.has(customer.id)}
                        onCheckedChange={() => toggleSelect(customer.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {getDisplayName(customer)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-md truncate">
                      {getCompanyInfo(customer)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {customer.phone || customer.mobile_phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">
                      $0.00
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          className="text-sm text-[#2ca01c] hover:underline font-medium"
                          onClick={() => handleCreateEstimate(customer.id)}
                        >
                          Create estimate
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="ml-1 p-1 hover:bg-slate-100 rounded">
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCustomer(customer as Customer)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCreateEstimate(customer.id)}>
                              Create estimate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {customers && customers.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-4 text-sm">
              <button 
                onClick={() => setPage(0)} 
                disabled={page === 0}
                className={page === 0 ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 font-medium cursor-pointer hover:underline'}
              >
                First
              </button>
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))} 
                disabled={page === 0}
                className={page === 0 ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 font-medium cursor-pointer hover:underline'}
              >
                Previous
              </button>
              <div className="flex items-center gap-1 text-slate-600">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page + 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setPage(val - 1);
                    }
                  }}
                  className="w-12 px-2 py-1 text-center border border-slate-300 rounded text-sm"
                />
                <span>/ {totalPages}</span>
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                disabled={page >= totalPages - 1}
                className={page >= totalPages - 1 ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 font-medium cursor-pointer hover:underline'}
              >
                Next
              </button>
              <button 
                onClick={() => setPage(totalPages - 1)} 
                disabled={page >= totalPages - 1}
                className={page >= totalPages - 1 ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 font-medium cursor-pointer hover:underline'}
              >
                Last
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Edit Side Panel */}
      <CustomerSidePanel
        open={isCustomerPanelOpen}
        onOpenChange={handlePanelClose}
        customer={editingCustomer}
        onSave={handleCustomerSaved}
        showHistory={viewMode === 'history'}
        initialSearchText={!editingCustomer ? (initialSearchText || searchQuery) : undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} customer(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected customers will be permanently deleted.
              Any linked jobs or estimates may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelected} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Customers</DialogTitle>
            <DialogDescription>
              Select the primary customer to keep. All jobs and data from other selected customers will be moved to this customer, then the duplicates will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-3 block">Select primary customer to keep:</Label>
            <RadioGroup value={primaryMergeId || ''} onValueChange={setPrimaryMergeId}>
              {selectedCustomers.map((customer: any) => (
                <div key={customer.id} className="flex items-center space-x-3 py-2">
                  <RadioGroupItem value={customer.id} id={customer.id} />
                  <Label htmlFor={customer.id} className="cursor-pointer">
                    <span className="font-medium">{getDisplayName(customer)}</span>
                    {customer.email && <span className="text-muted-foreground ml-2">({customer.email})</span>}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMergeCustomers} disabled={!primaryMergeId}>
              <Merge className="h-4 w-4 mr-2" />
              Merge Customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
