import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Check, UserPlus, User, X, ExternalLink, ScanBarcode } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { detectWatchFromReference } from "@/lib/watch-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomers, type Customer } from "@/hooks/use-customers";
import { WatchSelector } from "./WatchSelector";
import { type Watch, type JobWatchRef } from "@/hooks/use-watches";

type CustomerFormData = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
};

type WatchFormData = {
  id?: string;
  brand: string;
  model: string;
  referenceNumber: string;
  estimateNumber: string;
};


interface CustomerFormProps {
  value: CustomerFormData;
  onChange: (value: CustomerFormData) => void;
  watchValue: WatchFormData;
  onWatchChange: (value: WatchFormData) => void;
  onWatchIdChange: (id: string | null) => void;
  selectedWatchId: string | null;
  onNext: (options?: { isBraceletOnly?: boolean }) => void;
  onBarcodeScan?: (rawData: string) => void;
}

export function CustomerForm({
  value,
  onChange,
  watchValue,
  onWatchChange,
  onWatchIdChange,
  selectedWatchId,
  onNext,
  onBarcodeScan,
}: CustomerFormProps) {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);
  // Start in search mode (not "new customer" mode) so duplicates appear while typing.
  const [isNewCustomer, setIsNewCustomer] = React.useState(false);
  const [isNewWatch, setIsNewWatch] = React.useState(false);
  const [isBraceletOnlySkip, setIsBraceletOnlySkip] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { data: customers = [], isLoading } = useCustomers(search);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find exact name match for inline duplicate detection
  const exactNameMatch = React.useMemo(() => {
    if (!customers || !search.trim()) return null;
    const searchLower = search.trim().toLowerCase();
    return customers.find((c) => c.name.toLowerCase() === searchLower) || null;
  }, [customers, search]);

  const handleSelectCustomer = (customer: Customer) => {
    onChange({
      id: customer.id,
      name: customer.name,
      email: customer.email || "",
    });
    setIsNewCustomer(false);
    // Reset watch selection when customer changes
    onWatchIdChange(null);
    setIsNewWatch(false);
    setShowDropdown(false);
    setSearch("");
    toast.success(`Selected existing customer: ${customer.name}`);
  };

  const handleCreateNew = () => {
    onChange({ name: search.trim(), email: "", phone: "" });
    setIsNewCustomer(true);
    setIsNewWatch(true); // New customer always needs new watch
    onWatchIdChange(null);
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    onChange({ name: "", email: "", phone: "" });
    setIsNewCustomer(false);
    setSearch("");
    onWatchIdChange(null);
    setIsNewWatch(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // If in new customer mode, update the customer name directly
    if (isNewCustomer) {
      onChange({ ...value, name: val });
      if (!val.trim()) {
        setIsNewCustomer(false);
        setSearch("");
      }
      return;
    }
    
    setSearch(val);
    setShowDropdown(true);
    // Clear selection if user starts typing when there's already a selection
    if (value.id) {
      onChange({ name: "", email: "", phone: "" });
      setIsNewCustomer(false);
      onWatchIdChange(null);
      setIsNewWatch(false);
    }
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleSelectWatch = (watch: Watch | null) => {
    if (watch) {
      onWatchIdChange(watch.id);
      onWatchChange({
        id: watch.id,
        brand: watch.brand,
        model: watch.model || "",
        referenceNumber: watch.reference_number || "",
        estimateNumber: watch.estimate_number,
      });
      setIsNewWatch(false);
    } else {
      onWatchIdChange(null);
      setIsNewWatch(true);
    }
  };

  const handleSelectJobRef = (jobRef: JobWatchRef) => {
    // Pre-fill watch form with data from the job
    onWatchChange({
      brand: jobRef.brand,
      model: jobRef.model || "",
      referenceNumber: jobRef.reference_number || "",
      estimateNumber: jobRef.estimate_number,
    });
    setIsNewWatch(true); // Treat as new watch (will create watch record)
    setIsBraceletOnlySkip(false);
    toast.success(`Loaded watch data from existing job: ${jobRef.reference_number}`);
  };

  const handleAddNewWatch = () => {
    onWatchIdChange(null);
    onWatchChange({
      brand: "",
      model: "",
      referenceNumber: "",
      estimateNumber: "",
    });
    setIsNewWatch(true);
    setIsBraceletOnlySkip(false);
  };

  const handleSkipForBracelet = () => {
    // Set minimal watch data for bracelet-only inspection
    onWatchIdChange(null);
    onWatchChange({
      brand: "Rolex", // Default brand for bracelets
      model: "",
      referenceNumber: "",
      estimateNumber: "",
    });
    setIsNewWatch(true);
    setIsBraceletOnlySkip(true);
  };

  const hasResults = customers && customers.length > 0;
  const hasNoResults = !isLoading && customers && customers.length === 0 && search.trim().length > 0;

  // Display value in the input - show name when isNewCustomer, otherwise show selected customer or search
  const displayValue = value.id 
    ? (value.name.trim() ? `${value.name}${value.email ? ` (${value.email})` : ""}` : value.email || "Unknown customer")
    : isNewCustomer 
      ? value.name 
      : search;

  // For existing customer: require watch selection or new watch with required fields
  // For new customer: only require name (watch details are optional)
  // For bracelet-only skip: just require name and estimate number
  const canProceed = React.useMemo(() => {
    if (!value.name.trim()) return false;
    
    // New customer: only name is required, watch details are optional
    if (isNewCustomer) return true;
    
    // If existing watch selected, we're good
    if (selectedWatchId && !isNewWatch) return true;
    
    // Bracelet-only skip: only require estimate number
    if (isBraceletOnlySkip) {
      return watchValue.estimateNumber.trim().length > 0;
    }
    
    // If new watch for existing customer, need brand and estimate number
    if (isNewWatch) {
      return watchValue.brand.trim().length > 0 && watchValue.estimateNumber.trim().length > 0;
    }
    
    // Existing customer with no watch selected yet
    return false;
  }, [value.name, selectedWatchId, isNewWatch, isNewCustomer, isBraceletOnlySkip, watchValue.brand, watchValue.estimateNumber]);

  // Barcode paste input
  const [barcodeInput, setBarcodeInput] = React.useState("");
  const barcodeInputRef = React.useRef<HTMLInputElement>(null);

  const handleBarcodeSubmit = React.useCallback(() => {
    const trimmed = barcodeInput.trim();
    if (trimmed.length >= 5 && onBarcodeScan) {
      onBarcodeScan(trimmed);
      setBarcodeInput("");
    }
  }, [barcodeInput, onBarcodeScan]);

  return (
    <div className="space-y-4">
      {/* Barcode scan/paste input */}
      {onBarcodeScan && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && barcodeInput.trim().length >= 5) {
                  e.preventDefault();
                  handleBarcodeSubmit();
                }
              }}
              placeholder="Scan or paste barcode label data…"
              className="pl-9 font-mono text-xs"
            />
          </div>
          <Button
            variant="default"
            size="sm"
            disabled={barcodeInput.trim().length < 5}
            onClick={handleBarcodeSubmit}
          >
            Process
          </Button>
        </div>
      )}

      <div className="space-y-1">
        <Label>Customer</Label>
        <div className="relative">
          <Input
            ref={inputRef}
            value={displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder="Type customer name..."
            className={cn((value.id || isNewCustomer) && "pr-8")}
          />
          {(value.id || isNewCustomer) && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {/* Dropdown */}
          {showDropdown && !value.id && !isNewCustomer && (
            <div
              ref={dropdownRef}
              className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto"
            >
              {/* Exact Name Match */}
              {exactNameMatch && (
                <div className="p-2 border-b">
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Existing customer found:</p>
                          <p className="font-medium text-sm">{exactNameMatch.name}</p>
                          {exactNameMatch.email && (
                            <p className="text-xs text-muted-foreground">{exactNameMatch.email}</p>
                          )}
                          {exactNameMatch.phone && (
                            <p className="text-xs text-muted-foreground">{exactNameMatch.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => handleSelectCustomer(exactNameMatch)}
                        >
                          Use Existing
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8"
                          onClick={handleCreateNew}
                        >
                          Add Another
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* No results */}
              {hasNoResults && (
                <div className="p-2">
                  <Card className="border-dashed">
                    <CardContent className="p-3 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        No customer named "<span className="font-medium text-foreground">{search}</span>" found
                      </p>
                      <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="gap-1.5"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Add New Customer
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Partial matches list (excluding exact match) */}
              {hasResults && !exactNameMatch && (
                <div className="py-1">
                  <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Matching customers</p>
                  {customers?.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value.id === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{customer.name}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCustomer(customer);
                              }}
                            >
                              Use Existing
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateNew();
                              }}
                            >
                              Add Another
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.email && <span>{customer.email}</span>}
                          {customer.email && customer.phone && <span> · </span>}
                          {customer.phone && <span>{customer.phone}</span>}
                          {!customer.email && !customer.phone && <span className="italic">No contact info</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="p-3 text-sm text-muted-foreground text-center">Searching…</div>
              )}

              {/* Show all customers when no search */}
              {!search.trim() && hasResults && (
                <div className="py-1">
                  {customers?.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value.id === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{customer.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {customer.email && <span>{customer.email}</span>}
                          {customer.email && customer.phone && <span> · </span>}
                          {customer.phone && <span>{customer.phone}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Always show New Customer button at bottom */}
              <div className="border-t p-2 space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary"
                  onClick={handleCreateNew}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create new customer {search.trim() && `"${search.trim()}"`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => navigate("/clients/new")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  New Customer Page
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline new customer email/phone fields */}
      {isNewCustomer && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">New customer: {value.name}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => {
                setIsNewCustomer(false);
                onChange({ name: "", email: "", phone: "" });
                setSearch("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-customer-email">Email</Label>
              <Input
                id="new-customer-email"
                type="email"
                placeholder="john@example.com"
                value={value.email}
                onChange={(e) => onChange({ ...value, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-customer-phone">Phone</Label>
              <Input
                id="new-customer-phone"
                placeholder="(555) 123-4567"
                value={value.phone || ""}
                onChange={(e) => onChange({ ...value, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Watch Selection - only show for existing customers */}
      {value.id && !isNewCustomer && !isBraceletOnlySkip && (
        <div className="space-y-1">
          <Label>Watch</Label>
          <WatchSelector
            customerId={value.id}
            selectedWatchId={selectedWatchId}
            onSelectWatch={handleSelectWatch}
            onAddNew={handleAddNewWatch}
            onSkipForBracelet={handleSkipForBracelet}
            showBraceletSkip={true}
            onSelectJobRef={handleSelectJobRef}
          />
        </div>
      )}

      {/* Bracelet Only Skip Mode */}
      {isBraceletOnlySkip && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Bracelet Only Inspection</p>
              <p className="text-xs text-muted-foreground">
                No watch record will be linked. Enter an estimate number to continue.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsBraceletOnlySkip(false);
                setIsNewWatch(false);
              }}
            >
              Cancel
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="bracelet-brand">Brand</Label>
              <Input
                id="bracelet-brand"
                placeholder="e.g. Rolex"
                value={watchValue.brand}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, brand: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bracelet-model">Bracelet Model</Label>
              <Input
                id="bracelet-model"
                placeholder="e.g. Jubilee, Oyster"
                value={watchValue.model}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, model: e.target.value })
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bracelet-estimate">Estimate Number *</Label>
              <Input
                id="bracelet-estimate"
                placeholder="e.g. EST-2024-001"
                value={watchValue.estimateNumber}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, estimateNumber: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* New Watch Form */}
      {(isNewWatch || isNewCustomer) && !isBraceletOnlySkip && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium text-muted-foreground">
            {isNewCustomer ? "Watch details" : "New watch details"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="watch-estimate">Estimate # *</Label>
              <Input
                id="watch-estimate"
                placeholder="e.g. EST-2024-001"
                value={watchValue.estimateNumber}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, estimateNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="watch-ref">Reference #</Label>
              <Input
                id="watch-ref"
                placeholder="e.g. 126610LN"
                value={watchValue.referenceNumber}
                onChange={(e) => {
                  const newRef = e.target.value;
                  const detected = detectWatchFromReference(newRef);
                  if (detected) {
                    onWatchChange({
                      ...watchValue,
                      referenceNumber: newRef,
                      brand: detected.brand,
                      model: detected.model,
                    });
                  } else {
                    onWatchChange({ ...watchValue, referenceNumber: newRef });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="watch-brand">Brand *</Label>
              <Input
                id="watch-brand"
                placeholder="e.g. Rolex"
                value={watchValue.brand}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, brand: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="watch-model">Model</Label>
              <Input
                id="watch-model"
                placeholder="e.g. Submariner"
                value={watchValue.model}
                onChange={(e) =>
                  onWatchChange({ ...watchValue, model: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => onNext({ isBraceletOnly: isBraceletOnlySkip })} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  );
}
