import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subWeeks, subQuarters, parse, isValid } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  FileText,
  RefreshCw,
  Loader2,
  Shield,
  Search,
  Lock,
  Unlock,
  DollarSign,
} from 'lucide-react';

type DatePreset = 'custom' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'custom', label: 'Custom Range' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
];

const getPresetDates = (preset: DatePreset): { start: Date; end: Date } => {
  const now = new Date();
  switch (preset) {
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case 'last_week':
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'last_quarter':
      const lastQuarter = subQuarters(now, 1);
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
    default:
      return { start: subMonths(now, 12), end: now };
  }
};

const QBOInvoiceSyncPage = () => {
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('last_month');
  const [startDateStr, setStartDateStr] = useState(() => format(getPresetDates('last_month').start, 'MM/dd/yyyy'));
  const [endDateStr, setEndDateStr] = useState(() => format(getPresetDates('last_month').end, 'MM/dd/yyyy'));
  
  // Editable mode toggle - default to read-only (false)
  const [importAsEditable, setImportAsEditable] = useState(false);

  // Parse dates from strings
  const parsedDates = useMemo(() => {
    const parseDate = (str: string) => {
      const parsed = parse(str, 'MM/dd/yyyy', new Date());
      return isValid(parsed) ? parsed : null;
    };
    return {
      start: parseDate(startDateStr),
      end: parseDate(endDateStr),
    };
  }, [startDateStr, endDateStr]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset);
      setStartDateStr(format(start, 'MM/dd/yyyy'));
      setEndDateStr(format(end, 'MM/dd/yyyy'));
    }
  };

  const handleDateInputChange = (type: 'start' | 'end', value: string) => {
    setDatePreset('custom');
    if (type === 'start') {
      setStartDateStr(value);
    } else {
      setEndDateStr(value);
    }
  };

  // Fetch invoices - must be before conditional returns
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['qbo-invoices', search],
    queryFn: async () => {
      let query = supabase
        .from('qbo_invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
        .limit(200);

      if (search) {
        query = query.or(`doc_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!parsedDates.start || !parsedDates.end) {
        throw new Error('Invalid date format. Use MM/DD/YYYY');
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('qbo-invoice-sync', {
        body: { 
          environment: 'production', 
          start_date: format(parsedDates.start, 'yyyy-MM-dd'),
          end_date: format(parsedDates.end, 'yyyy-MM-dd'),
          force_editable: importAsEditable,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Complete',
        description: `Fetched ${data.invoices_fetched} invoices (${data.created} new, ${data.updated} updated)`,
      });
      queryClient.invalidateQueries({ queryKey: ['qbo-invoices'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Permission check - after all hooks
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">QBO Invoice Sync</h1>
          <p className="text-muted-foreground mt-1">
            Import and view invoices from QuickBooks Online
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || !parsedDates.start || !parsedDates.end}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync Invoices
        </Button>
      </div>

      {/* Sync Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sync Options</CardTitle>
          <CardDescription>Configure which invoices to import</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Range:</Label>
              <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">From:</Label>
              <Input
                type="text"
                placeholder="MM/DD/YYYY"
                value={startDateStr}
                onChange={(e) => handleDateInputChange('start', e.target.value)}
                className={`w-[130px] ${!parsedDates.start ? 'border-destructive' : ''}`}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">To:</Label>
              <Input
                type="text"
                placeholder="MM/DD/YYYY"
                value={endDateStr}
                onChange={(e) => handleDateInputChange('end', e.target.value)}
                className={`w-[130px] ${!parsedDates.end ? 'border-destructive' : ''}`}
              />
            </div>
          </div>

          {/* Editable Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <Switch
              id="editable-mode"
              checked={importAsEditable}
              onCheckedChange={setImportAsEditable}
            />
            <Label htmlFor="editable-mode" className="flex items-center gap-2 cursor-pointer">
              {importAsEditable ? (
                <>
                  <Unlock className="h-4 w-4 text-green-600" />
                  <span>Import as Editable</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Import as Read-Only</span>
                </>
              )}
            </Label>
            <span className="text-xs text-muted-foreground ml-2">
              {importAsEditable 
                ? 'Invoices can be modified after import' 
                : 'Invoices will be stored as view-only snapshots (default)'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Unlock className="h-4 w-4 text-green-600" />
          <span>Editable</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span>View only</span>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Synced Invoices
          </CardTitle>
          <CardDescription>
            {invoices?.length || 0} invoices loaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {invoicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading invoices...
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        {invoice.is_editable ? (
                          <Unlock className="h-4 w-4 text-green-600" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.doc_number || '-'}
                      </TableCell>
                      <TableCell>{invoice.customer_name || '-'}</TableCell>
                      <TableCell>
                        {invoice.invoice_date
                          ? format(new Date(invoice.invoice_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date
                          ? format(new Date(invoice.due_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {Number(invoice.total_amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(invoice.balance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status || 'open')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No invoices synced yet</p>
              <p className="text-sm">Click "Sync Invoices" to import from QuickBooks</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QBOInvoiceSyncPage;
