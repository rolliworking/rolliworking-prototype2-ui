import { useState, useRef, useEffect } from 'react';
import { Search, Plus, X, Loader2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCustomers } from '@/hooks/useCustomers';
import { Customer } from '@/types/database';
import { CustomerSidePanel } from './CustomerSidePanel';
import { cn } from '@/lib/utils';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
  onCustomerChange?: (customer: Customer) => void;
}

export function CustomerSelector({
  selectedCustomer,
  onCustomerSelect,
  onCustomerChange,
}: CustomerSelectorProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [initialSearchText, setInitialSearchText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: customers, isLoading } = useCustomers(search);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    onCustomerSelect(customer);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomerClick = () => {
    if (selectedCustomer) {
      setEditingCustomer(selectedCustomer);
      setPanelOpen(true);
    }
  };

  const handleAddNewCustomer = () => {
    setEditingCustomer(null);
    setInitialSearchText(search); // Capture search text before clearing
    setPanelOpen(true);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomerSaved = (customer: Customer) => {
    if (editingCustomer) {
      // Editing existing customer
      onCustomerChange?.(customer);
    } else {
      // New customer created
      onCustomerSelect(customer);
    }
    setInitialSearchText(''); // Clear after save
  };

  const handlePanelClose = (open: boolean) => {
    setPanelOpen(open);
    if (!open) {
      setInitialSearchText(''); // Clear when panel closes
    }
  };

  const handleClearCustomer = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCustomerSelect(null);
  };

  const handleInputFocus = () => {
    if (!selectedCustomer) {
      setIsOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  // The server query already filters, so we just use the results directly
  // (useCustomers applies the search filter via ilike on first_name, last_name, email, display_name, phone)
  const filteredCustomers = customers;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {selectedCustomer ? (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={handleCustomerClick}
              className="inline-flex items-center gap-2 border-2 border-[#2ca01c] rounded px-3 py-2 bg-white hover:bg-slate-50 transition-colors"
            >
              <User className="h-4 w-4 text-[#2ca01c]" />
              <span className="text-[#2ca01c] font-medium">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </span>
            </button>
            <button
              onClick={handleClearCustomer}
              className="p-1 rounded hover:bg-slate-100"
              title="Clear customer"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
        ) : (
          <div className="relative inline-block min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder="Search or add customer..."
              className={cn(
                "pl-9 pr-3 h-10 text-sm border-2 border-[#2ca01c] focus:ring-[#2ca01c] focus:border-[#2ca01c]",
                isOpen && "rounded-b-none border-b-slate-200"
              )}
              value={search}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
            />
          </div>
        )}

        {isOpen && !selectedCustomer && (
          <div className="absolute z-50 left-0 right-0 w-[280px] bg-white border-2 border-t-0 border-[#2ca01c] rounded-b-lg shadow-lg">
            {/* Customer list */}
            <div className="max-h-60 overflow-auto">
              {isLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : filteredCustomers && filteredCustomers.length > 0 ? (
                filteredCustomers.slice(0, 10).map((customer) => (
                  <button
                    key={customer.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <p className="font-medium text-slate-900 text-sm">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <div className="flex gap-3 text-xs text-slate-500">
                      {customer.email && <span>{customer.email}</span>}
                      {customer.phone && <span>{customer.phone}</span>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-500">
                  {search ? 'No customers found' : 'Start typing to search'}
                </div>
              )}
            </div>

            {/* Add new customer */}
            <div className="border-t border-slate-200">
              <button
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-[#2ca01c] text-sm font-medium"
                onClick={handleAddNewCustomer}
              >
                <Plus className="h-4 w-4" />
                Add new customer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Side Panel */}
      <CustomerSidePanel
        open={panelOpen}
        onOpenChange={handlePanelClose}
        customer={editingCustomer}
        onSave={handleCustomerSaved}
        initialSearchText={initialSearchText}
      />
    </>
  );
}
