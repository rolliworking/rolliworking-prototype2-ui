import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Customer } from '@/types/database';

interface SearchDropdownProps {
  isOpen: boolean;
  isLoading: boolean;
  children: React.ReactNode;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
}

function SearchDropdown({ isOpen, isLoading, children, inputRef, onClose }: SearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const updatePosition = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      left: rect.left,
      top: rect.bottom + 2,
      width: Math.max(280, rect.width),
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !style) return null;

  const portalContainer =
    (inputRef.current?.closest('[role="dialog"]') as HTMLElement | null) ?? document.body;

  return createPortal(
    <div
      ref={dropdownRef}
      className="bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
      style={style}
    >
      {isLoading ? (
        <div className="p-3 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        children
      )}
    </div>,
    portalContainer
  );
}

// Customer Search Input
interface CustomerSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onCustomerSelect: (customer: Customer) => void;
  onAddNew: () => void;
  className?: string;
}

export function CustomerSearchInput({
  value,
  onChange,
  onCustomerSelect,
  onAddNew,
  className,
}: CustomerSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-search-qr', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: search.length >= 2,
  });

  const handleSelect = (customer: Customer) => {
    onChange(`${customer.first_name} ${customer.last_name}`);
    onCustomerSelect(customer);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value || search}
        onChange={(e) => {
          const val = e.target.value;
          if (value) onChange(val);
          else setSearch(val);
          setIsOpen(true);
        }}
        onFocus={() => !value && setIsOpen(true)}
        className={cn("pl-7 text-sm", className)}
        placeholder="Search customer..."
      />
      <SearchDropdown
        isOpen={isOpen && !value && search.length >= 2}
        isLoading={isLoading}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        onClose={() => setIsOpen(false)}
      >
        <div className="py-1">
          {customers && customers.length > 0 ? (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="font-medium">{c.first_name} {c.last_name}</span>
                {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
              </button>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">No customers found</div>
          )}
          <button
            onClick={() => { onAddNew(); setIsOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent text-primary font-medium flex items-center gap-1 border-t"
          >
            <Plus className="h-3 w-3" /> Add new customer
          </button>
        </div>
      </SearchDropdown>
    </div>
  );
}

// Part Search Input (simplified version)
interface PartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onPartSelect: (part: { id: string; part_number: string; description: string }) => void;
  className?: string;
}

export function PartSearchInput({
  value,
  onChange,
  onPartSelect,
  className,
}: PartSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Use search term for query when actively searching, otherwise use value for display
  const searchTerm = search || value || '';

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-search-qr', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from('parts')
        .select('id, part_number, description')
        .eq('is_active', true)
        .or(`part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchTerm.length >= 2,
  });

  const handleSelect = (part: { id: string; part_number: string; description: string }) => {
    onChange(part.part_number);
    onPartSelect(part);
    setIsOpen(false);
    setSearch('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={search || value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        className={cn("pl-7 text-sm font-mono", className)}
        placeholder="Search part..."
      />
      <SearchDropdown
        isOpen={isOpen && searchTerm.length >= 2}
        isLoading={isLoading}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        onClose={() => { setIsOpen(false); setSearch(''); }}
      >
        <div className="py-1">
          {parts && parts.length > 0 ? (
            parts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="font-medium font-mono">{p.part_number}</span>
                <span className="text-muted-foreground ml-2 text-[11px]">{p.description}</span>
              </button>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">No parts found</div>
          )}
        </div>
      </SearchDropdown>
    </div>
  );
}

// Estimate Search Input
interface EstimateSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEstimateSelect: (estimate: { id: string; estimate_number: string; customer_name: string }) => void;
  className?: string;
}

export function EstimateSearchInput({
  value,
  onChange,
  onEstimateSelect,
  className,
}: EstimateSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: estimates, isLoading } = useQuery({
    queryKey: ['estimates-search-qr', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data, error } = await supabase
        .from('estimates')
        .select('id, estimate_number, customers(first_name, last_name)')
        .ilike('estimate_number', `%${search}%`)
        .limit(10);
      if (error) throw error;
      return (data || []).map((e: any) => ({
        id: e.id,
        estimate_number: e.estimate_number,
        customer_name: e.customers ? `${e.customers.first_name} ${e.customers.last_name}` : '',
      }));
    },
    enabled: search.length >= 2,
  });

  const handleSelect = (est: { id: string; estimate_number: string; customer_name: string }) => {
    onChange(est.estimate_number);
    onEstimateSelect(est);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value || search}
        onChange={(e) => {
          const val = e.target.value;
          if (value) onChange(val);
          else setSearch(val);
          setIsOpen(true);
        }}
        onFocus={() => !value && setIsOpen(true)}
        className={cn("pl-7 text-sm font-mono", className)}
        placeholder="Search estimate..."
      />
      <SearchDropdown
        isOpen={isOpen && !value && search.length >= 2}
        isLoading={isLoading}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        onClose={() => setIsOpen(false)}
      >
        <div className="py-1">
          {estimates && estimates.length > 0 ? (
            estimates.map((e) => (
              <button
                key={e.id}
                onClick={() => handleSelect(e)}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="font-medium font-mono">{e.estimate_number?.replace(/^EST-/, 'E')}</span>
                {e.customer_name && <span className="text-muted-foreground ml-2">{e.customer_name}</span>}
              </button>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">No estimates found</div>
          )}
        </div>
      </SearchDropdown>
    </div>
  );
}
