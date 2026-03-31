import * as React from "react";
import { Check, UserPlus, AlertCircle, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useCustomers, useCreateCustomer, type Customer } from "@/hooks/use-customers";
import { toast } from "sonner";

export type SelectedClient = {
  id: string;
  name: string;
  email: string | null;
};

interface ClientSelectorProps {
  value: SelectedClient | null;
  onChange: (client: SelectedClient | null) => void;
  disabled?: boolean;
}

export function ClientSelector({ value, onChange, disabled = false }: ClientSelectorProps) {
  const [search, setSearch] = React.useState("");
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [newClientOpen, setNewClientOpen] = React.useState(false);
  const [newClient, setNewClient] = React.useState({ name: "", email: "", phone: "" });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { data: customers, isLoading } = useCustomers(search);
  const createCustomer = useCreateCustomer();

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

  // Fetch all customers when new client dialog opens (for duplicate checking)
  const { data: allCustomers } = useCustomers("");

  // Check against all customers for duplicates
  const duplicateMatch = React.useMemo(() => {
    if (!allCustomers || allCustomers.length === 0) return null;
    if (!newClient.name.trim() && !newClient.email.trim()) return null;

    const nameInput = newClient.name.trim().toLowerCase();
    const emailInput = newClient.email.trim().toLowerCase();

    return allCustomers.find((c) => {
      const nameMatch = nameInput && c.name.toLowerCase() === nameInput;
      const emailMatch = emailInput && c.email?.toLowerCase() === emailInput;
      return (nameMatch && emailMatch) || emailMatch;
    }) || null;
  }, [allCustomers, newClient.name, newClient.email]);

  const handleUseExisting = (customer: Customer) => {
    onChange({ id: customer.id, name: customer.name, email: customer.email });
    setNewClientOpen(false);
    setNewClient({ name: "", email: "", phone: "" });
    setSearch("");
    setShowDropdown(false);
    toast.success(`Selected existing client: ${customer.name}`);
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!newClient.email.trim()) {
      toast.error("Email is required");
      return;
    }

    try {
      const created = await createCustomer.mutateAsync({
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        phone: newClient.phone.trim() || undefined,
      });
      onChange({ id: created.id, name: created.name, email: created.email });
      setNewClientOpen(false);
      setNewClient({ name: "", email: "", phone: "" });
      toast.success("Client created");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create client");
    }
  };

  const handleAddNewFromSearch = () => {
    setNewClient((c) => ({ ...c, name: search.trim() }));
    setNewClientOpen(true);
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    onChange(null);
    setSearch("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setShowDropdown(true);
    // Clear selection if user starts typing when there's already a selection
    if (value) {
      onChange(null);
    }
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const hasResults = customers && customers.length > 0;
  const hasNoResults = !isLoading && customers && customers.length === 0 && search.trim().length > 0;

  // Display value in the input
  const displayValue = value ? `${value.name}${value.email ? ` (${value.email})` : ""}` : search;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Type client name..."
          disabled={disabled}
          className={cn(value && "pr-8")}
        />
        {value && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Dropdown */}
        {showDropdown && !value && (
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
                        <p className="text-xs text-muted-foreground mb-1">Existing client found:</p>
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
                        onClick={() => handleUseExisting(exactNameMatch)}
                      >
                        Use Existing
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8"
                        onClick={handleAddNewFromSearch}
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
                      No client named "<span className="font-medium text-foreground">{search}</span>" found
                    </p>
                    <Button
                      size="sm"
                      onClick={handleAddNewFromSearch}
                      className="gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add New Client
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Partial matches list (excluding exact match) */}
            {hasResults && !exactNameMatch && (
              <div className="py-1">
                <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Matching clients</p>
                {customers?.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleUseExisting(customer)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 text-sm">
                      {customer.name}
                      {customer.email && (
                        <span className="ml-1 text-muted-foreground">({customer.email})</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="p-3 text-sm text-muted-foreground text-center">Loading...</div>
            )}

            {/* Show all customers when no search */}
            {!search.trim() && hasResults && (
              <div className="py-1">
                {customers?.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleUseExisting(customer)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 text-sm">
                      {customer.name}
                      {customer.email && (
                        <span className="ml-1 text-muted-foreground">({customer.email})</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Always show New Client button at bottom */}
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary"
                onClick={handleAddNewFromSearch}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                New Client {search.trim() && `"${search.trim()}"`}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newClient.phone}
                onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>

            {/* Duplicate Detection Alert */}
            {duplicateMatch && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="ml-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-amber-800 dark:text-amber-200">
                      A client with this {duplicateMatch.email?.toLowerCase() === newClient.email.trim().toLowerCase() ? "email" : "name"} already exists:
                    </span>
                    <div className="flex items-center justify-between bg-background rounded-md p-2 border">
                      <span className="text-sm font-medium">
                        {duplicateMatch.name}
                        {duplicateMatch.email && (
                          <span className="ml-1 text-muted-foreground">({duplicateMatch.email})</span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUseExisting(duplicateMatch)}
                        className="ml-2"
                      >
                        Use Existing
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setNewClientOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={createCustomer.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {createCustomer.isPending ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
