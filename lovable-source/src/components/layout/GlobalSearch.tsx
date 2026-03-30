import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Search, 
  X, 
  User, 
  FileText, 
  Box,
  Loader2,
  UserPlus,
} from 'lucide-react';

interface SearchResult {
  type: 'customer' | 'estimate' | 'part';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  jobStatus?: string | null;
  hasNewLead?: boolean;
}

const jobStatusColors: Record<string, string> = {
  estimate: 'bg-slate-100 text-slate-700',
  waiting_inspection: 'bg-purple-100 text-purple-700',
  on_hand: 'bg-blue-100 text-blue-700',
  finished: 'bg-emerald-100 text-emerald-700',
};

const jobStatusLabels: Record<string, string> = {
  estimate: 'Estimate',
  waiting_inspection: 'Waiting Inspection',
  on_hand: 'On Hand',
  finished: 'Finished',
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['global-search-customers', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || debouncedSearch.length < 2) return [];
      const searchLower = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, display_name, email, phone, phone_normalized')
        .or(`first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,display_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchLower}%,phone_normalized.ilike.%${searchLower}%`)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  // Search estimates - normalize E prefix to EST- for database search
  const { data: estimates = [], isLoading: loadingEstimates } = useQuery({
    queryKey: ['global-search-estimates', debouncedSearch],
    queryFn: async () => {
      const trimmedSearch = debouncedSearch.trim();
      if (!trimmedSearch || trimmedSearch.length < 2) return [];
      
      // Normalize search: strip E or EST- prefix to get the numeric part
      let searchNumber = trimmedSearch;
      if (/^est-/i.test(trimmedSearch)) {
        // Starts with EST- -> extract the number
        searchNumber = trimmedSearch.slice(4);
      } else if (/^e\d+$/i.test(trimmedSearch)) {
        // Starts with E followed by digits only -> extract the number
        searchNumber = trimmedSearch.slice(1);
      }
      
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id, 
          estimate_number, 
          customer:customers(first_name, last_name, display_name),
          jobs!estimates_job_id_fkey(simple_status)
        `)
        .ilike('estimate_number', `%${searchNumber}%`)
        .limit(5);
      if (error) throw error;
      return data || [];
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  // Search parts
  const { data: parts = [], isLoading: loadingParts } = useQuery({
    queryKey: ['global-search-parts', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || debouncedSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description, brand')
        .or(`part_number.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  // Fetch pending leads to check if customers have new requests
  const { data: pendingLeads = [] } = useQuery({
    queryKey: ['global-search-pending-leads', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || debouncedSearch.length < 2) return [];
      const searchLower = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from('intake_leads')
        .select('email, customer_id')
        .eq('status', 'new')
        .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  const isLoading = loadingCustomers || loadingEstimates || loadingParts;

  // Build results - sorted by: estimates, sales orders (parts for now), customers
  const results: SearchResult[] = [
    // Estimates first
    ...estimates.map((e: any) => {
      const jobStatus = e.jobs ? (Array.isArray(e.jobs) ? e.jobs[0]?.simple_status : e.jobs.simple_status) : null;
      return {
        type: 'estimate' as const,
        id: e.id,
        title: e.estimate_number,
        subtitle: e.customer?.display_name || `${e.customer?.first_name || ''} ${e.customer?.last_name || ''}`.trim(),
        href: `/estimates/${e.id}`,
        jobStatus,
      };
    }),
    // Parts (sales orders placeholder)
    ...parts.map((p: any) => ({
      type: 'part' as const,
      id: p.id,
      title: p.part_number,
      subtitle: p.description,
      href: `/inventory/parts?id=${p.id}`,
    })),
    // Customers last - navigate to customer detail page
    ...customers.map((c: any) => {
      // Check if this customer has a pending lead (by email or customer_id)
      const hasNewLead = pendingLeads.some(
        (lead: any) => lead.customer_id === c.id || 
          (c.email && lead.email?.toLowerCase() === c.email.toLowerCase())
      );
      return {
        type: 'customer' as const,
        id: c.id,
        title: c.display_name || `${c.first_name} ${c.last_name}`.trim(),
        subtitle: c.email || c.phone,
        href: `/customers/${c.id}`,
        hasNewLead,
      };
    }),
  ];

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    setSearchTerm('');
    setIsOpen(false);
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'estimate':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'part':
        return <Box className="h-4 w-4 text-amber-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return 'Customer';
      case 'estimate':
        return 'Estimate';
      case 'part':
        return 'Part';
    }
  };

  return (
    <div ref={containerRef} className="relative w-[672px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search name, est#, part#, email, phone..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-8 h-9 bg-muted/50 border-0 focus-visible:ring-1"
      />
      {searchTerm && (
        <button
          onClick={() => {
            setSearchTerm('');
            setIsOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-2">
              <div className="py-4 text-center text-sm text-muted-foreground">
                No results found
              </div>
              {/* Add Customer option when no results */}
              <button
                onClick={() => {
                  // Navigate to customers page with the search term to pre-fill
                  navigate(`/customers?new=true&name=${encodeURIComponent(searchTerm.trim())}`);
                  setSearchTerm('');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 border-t"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Add "{searchTerm.trim()}" as new customer</div>
                  <div className="text-xs text-muted-foreground">Create a new customer record</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    index === selectedIndex ? 'bg-accent' : 'hover:bg-muted/50'
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                    )}
                  </div>
                  {result.hasNewLead && (
                    <Badge 
                      className="text-[10px] px-1.5 py-0 shrink-0 bg-orange-100 text-orange-700 cursor-pointer hover:bg-orange-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/intake/leads?search=${encodeURIComponent(result.title)}`);
                        setSearchTerm('');
                        setIsOpen(false);
                      }}
                    >
                      New Request
                    </Badge>
                  )}
                  {result.jobStatus && (
                    <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", jobStatusColors[result.jobStatus] || 'bg-gray-100 text-gray-700')}>
                      {jobStatusLabels[result.jobStatus] || result.jobStatus}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {getTypeLabel(result.type)}
                  </span>
                </button>
              ))}
            </div>
          )}
          
          {/* Keyboard hint */}
          <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>
      )}
    </div>
  );
}