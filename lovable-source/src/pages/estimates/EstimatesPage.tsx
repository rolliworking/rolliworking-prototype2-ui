import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  FileText, 
  CheckCircle2, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings,
  Search,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { EstimateStatus } from '@/types/estimates';
import { useDeleteEstimate, useDuplicateEstimate } from '@/hooks/useEstimates';

const statusDisplay: Record<EstimateStatus, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: FileText, color: 'text-slate-500', label: 'Draft' },
  sent: { icon: CheckCircle2, color: 'text-blue-500', label: 'Sent' },
  converted: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Accepted' },
  expired: { icon: FileText, color: 'text-amber-500', label: 'Expired' },
  declined: { icon: FileText, color: 'text-red-500', label: 'Declined' },
};

const PAGE_SIZE = 50;

export default function EstimatesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('12months');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateSortAsc, setDateSortAsc] = useState(false);

  const deleteEstimate = useDeleteEstimate();
  const duplicateEstimate = useDuplicateEstimate();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: ['estimates', statusFilter, dateFilter, page, debouncedSearch, dateSortAsc],
    queryFn: async () => {
      // Build the query - we need to fetch all matching records then filter client-side for customer fields
      // because Supabase doesn't support OR across joined tables easily
      let query = supabase
        .from('estimates')
        .select(`
          *,
          customer:customers(id, first_name, last_name, display_name, email, phone)
        `)
        .order('created_at', { ascending: dateSortAsc });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as EstimateStatus);
      }

      // Normalize estimate number search: "E20051" or "20051" -> "EST-20051"
      let normalizedEstSearch = debouncedSearch;
      if (debouncedSearch) {
        if (/^e\d+$/i.test(debouncedSearch.trim())) {
          normalizedEstSearch = `EST-${debouncedSearch.trim().slice(1)}`;
        } else if (/^\d+$/.test(debouncedSearch.trim())) {
          normalizedEstSearch = `EST-${debouncedSearch.trim()}`;
        }
      }

      // Don't filter by estimate_number in database query - we'll do it client-side
      // This allows us to also match customer names, emails, etc.
      const { data: allData, error } = await query;
      if (error) throw error;

      // Filter client-side for customer fields if searching
      let filteredData = allData || [];
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase().trim();
        filteredData = filteredData.filter((est: any) => {
          // Match estimate number (also check normalized version for E20051 format)
          const estNumMatch = est.estimate_number?.toLowerCase().includes(searchLower) ||
            est.estimate_number?.toLowerCase().includes(normalizedEstSearch.toLowerCase());
          const firstNameMatch = est.customer?.first_name?.toLowerCase().includes(searchLower);
          const lastNameMatch = est.customer?.last_name?.toLowerCase().includes(searchLower);
          const emailMatch = est.customer?.email?.toLowerCase().includes(searchLower);
          const displayNameMatch = est.customer?.display_name?.toLowerCase().includes(searchLower);
          return estNumMatch || firstNameMatch || lastNameMatch || emailMatch || displayNameMatch;
        });
      }

      const totalCount = filteredData.length;
      const paginatedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      return { estimates: paginatedData, totalCount };
    },
  });

  const estimates = data?.estimates || [];
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
    if (selectedIds.size === estimates?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(estimates?.map((e: any) => e.id) || []));
    }
  };

  const getCustomerName = (customer: any) => {
    if (customer?.display_name) return customer.display_name;
    if (customer?.first_name || customer?.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    return '—';
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {/* QBO-style Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-semibold text-slate-900">Estimates</h1>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search est#, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 w-[240px] border-slate-300"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              )}
            </div>

            {/* Batch Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 font-normal border-slate-300 text-[#2ca01c] hover:text-[#248a17]">
                  Batch actions
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem disabled={selectedIds.size === 0}>
                  Print selected
                </DropdownMenuItem>
                <DropdownMenuItem disabled={selectedIds.size === 0}>
                  Send selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="converted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Date</span>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[140px] border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12months">Last 12 months</SelectItem>
                  <SelectItem value="6months">Last 6 months</SelectItem>
                  <SelectItem value="3months">Last 3 months</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Link to="/estimates/new">
            <Button className="bg-[#2ca01c] hover:bg-[#248a17] text-white font-medium px-6">
              Create estimate
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : estimates.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No estimates yet</p>
              <p className="text-sm mb-4">Create your first estimate to get started</p>
              <Link to="/estimates/new">
                <Button className="bg-[#2ca01c] hover:bg-[#248a17] text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create estimate
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr className="text-left">
                  <th className="w-12 px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.size === estimates?.length && estimates.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-50 select-none"
                    onClick={() => setDateSortAsc(prev => !prev)}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {dateSortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    No.
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-right">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      Status
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-right">
                    <div className="flex items-center justify-end gap-1">
                      Action
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.map((estimate: any) => {
                  const status = statusDisplay[estimate.status as EstimateStatus] || statusDisplay.draft;
                  const StatusIcon = status.icon;
                  return (
                    <tr 
                      key={estimate.id} 
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds.has(estimate.id)}
                          onCheckedChange={() => toggleSelect(estimate.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {format(new Date(estimate.created_at), 'M/d/yy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {estimate.estimate_number?.replace(/^EST-/, 'E') || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {getCustomerName(estimate.customer)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        ${(estimate.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${status.color}`} />
                          <div>
                            <div className="text-sm text-slate-900">{status.label}</div>
                            {estimate.sent_at && (
                              <div className="text-xs text-slate-500">
                                {estimate.status === 'converted' ? 'Viewed' : 'Sent'} {format(new Date(estimate.sent_at), 'M/d/yy')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link 
                            to={`/estimates/${estimate.id}`}
                            className="text-sm text-[#2ca01c] hover:underline font-medium"
                          >
                            View/Edit
                          </Link>
                          <span className="text-slate-300 mx-1">|</span>
                          <button 
                            className="text-sm text-[#2ca01c] hover:underline font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Convert to invoice logic
                            }}
                          >
                            Convert to invoice
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="ml-1 p-1 hover:bg-slate-100 rounded">
                                <ChevronDown className="h-3.5 w-3.5 text-[#2ca01c]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Fetch full estimate data with line items
                                  const { data: fullEstimate } = await supabase
                                    .from('estimates')
                                    .select('*, customer:customers(*)')
                                    .eq('id', estimate.id)
                                    .single();
                                  const { data: lineItems } = await supabase
                                    .from('estimate_line_items')
                                    .select('*')
                                    .eq('estimate_id', estimate.id)
                                    .order('sort_order');
                                  
                                  if (!fullEstimate) return;
                                  
                                  const customerName = fullEstimate.customer?.display_name || 
                                    `${fullEstimate.customer?.first_name || ''} ${fullEstimate.customer?.last_name || ''}`.trim();
                                  
                                  // Generate barcode SVG
                                  const barcodeValue = fullEstimate.estimate_number || '';
                                  const barcodeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                                  // @ts-ignore
                                  JsBarcode(barcodeSvg, barcodeValue, {
                                    format: 'CODE128',
                                    displayValue: true,
                                    width: 1.5,
                                    height: 30,
                                    margin: 0,
                                    fontSize: 10,
                                  });
                                  const barcodeHtml = barcodeSvg.outerHTML;
                                  
                                  const printWindow = window.open('', '_blank');
                                  if (!printWindow) return;
                                  
                                  printWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <title>Estimate ${fullEstimate.estimate_number}</title>
                                      <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                                        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                        .company { font-size: 24px; font-weight: bold; }
                                        .estimate-title { font-size: 20px; color: #666; margin-top: 5px; }
                                        .barcode { text-align: right; }
                                        .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                        .customer-info, .estimate-info { width: 48%; }
                                        .section-title { font-weight: bold; margin-bottom: 10px; color: #333; }
                                        .info-row { margin-bottom: 5px; color: #666; }
                                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                        th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; }
                                        td { padding: 10px; border-bottom: 1px solid #eee; }
                                        .amount { text-align: right; }
                                        .totals { margin-left: auto; width: 250px; }
                                        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                                        .total-row.final { font-weight: bold; font-size: 18px; border-top: 2px solid #333; border-bottom: none; }
                                        .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #2ca01c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                                        .print-btn:hover { background: #248a17; }
                                        @media print { .print-btn { display: none; } }
                                      </style>
                                    </head>
                                    <body>
                                      <button class="print-btn" onclick="window.print()">Print</button>
                                      <div class="header">
                                        <div>
                                          <div class="company">Rolliworks</div>
                                          <div class="estimate-title">Estimate</div>
                                        </div>
                                        <div class="barcode">${barcodeHtml}</div>
                                      </div>
                                      <div class="info-section">
                                        <div class="customer-info">
                                          <div class="section-title">Bill To</div>
                                          <div class="info-row">${customerName}</div>
                                          <div class="info-row">${fullEstimate.customer?.email || ''}</div>
                                          <div class="info-row">${fullEstimate.customer?.phone || ''}</div>
                                        </div>
                                        <div class="estimate-info">
                                          <div class="section-title">Estimate Details</div>
                                          <div class="info-row">Estimate #: ${fullEstimate.estimate_number}</div>
                                          <div class="info-row">Date: ${format(new Date(fullEstimate.created_at), 'MMM d, yyyy')}</div>
                                          ${fullEstimate.valid_until ? `<div class="info-row">Valid Until: ${format(new Date(fullEstimate.valid_until), 'MMM d, yyyy')}</div>` : ''}
                                        </div>
                                      </div>
                                      <table>
                                        <thead>
                                          <tr>
                                            <th>Description</th>
                                            <th class="amount">Qty</th>
                                            <th class="amount">Price</th>
                                            <th class="amount">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          ${(lineItems || []).map((item: any) => `
                                            <tr>
                                              <td>${item.description}</td>
                                              <td class="amount">${item.quantity}</td>
                                              <td class="amount">$${item.unit_price.toFixed(2)}</td>
                                              <td class="amount">$${item.extended_price.toFixed(2)}</td>
                                            </tr>
                                          `).join('')}
                                        </tbody>
                                      </table>
                                      <div class="totals">
                                        <div class="total-row"><span>Subtotal</span><span>$${(fullEstimate.subtotal || 0).toFixed(2)}</span></div>
                                        <div class="total-row"><span>Tax</span><span>$${(fullEstimate.tax_amount || 0).toFixed(2)}</span></div>
                                        <div class="total-row final"><span>Total</span><span>$${(fullEstimate.total_amount || 0).toFixed(2)}</span></div>
                                      </div>
                                    </body>
                                    </html>
                                  `);
                                  printWindow.document.close();
                                }}
                              >
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateEstimate.mutate(estimate.id, {
                                    onSuccess: (newEstimateId) => {
                                      navigate(`/estimates/${newEstimateId}`);
                                    }
                                  });
                                }}
                              >
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this estimate?')) {
                                    deleteEstimate.mutate(estimate.id);
                                  }
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {estimates.length > 0 && (
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
              <span className="text-slate-600">{startIndex}–{endIndex} of {totalCount}</span>
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
    </div>
  );
}
