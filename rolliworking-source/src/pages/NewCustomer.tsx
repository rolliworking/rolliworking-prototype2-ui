import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCreateCustomer } from "@/hooks/use-customers";
import { useCreateWatch, WATCH_BRANDS, ROLEX_MODELS, TUDOR_MODELS } from "@/hooks/use-watches";
import { detectWatchFromReference } from "@/lib/watch-constants";
import { useBarcodeScannerInput } from "@/hooks/use-barcode-scanner-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const NewCustomer = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  usePageMeta({
    title: "New Customer • Rolliworks",
    description: "Add a new customer and watch to the Rolliworks system.",
    canonicalPath: "/clients/new",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isStartingInspection, setIsStartingInspection] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    brand: "",
    model: "",
    referenceNumber: "",
    estimateNumber: "",
  });

  // Parse RS QR label format: Name^Email^Phone^Reference#^Date^Brand^Model^Estimate#
  const handleBarcodeScan = React.useCallback((scannedData: string) => {
    const parts = scannedData.split("^");
    
    // Accept 7 parts minimum (Est# is optional)
    if (parts.length >= 7) {
      const [name, email, phone, referenceNumber, , brand, model, estimateNumber = ""] = parts;
      setForm({
        name: name || "",
        email: email || "",
        phone: phone || "",
        referenceNumber: referenceNumber || "",
        brand: brand || "",
        model: model || "",
        estimateNumber: estimateNumber || "",
      });
      toast.success("QR data imported from scanner");
    } else {
      toast.error("Invalid QR format. Expected: Name^Email^Phone^Ref#^Date^Brand^Model (Est# optional)");
    }
  }, []);

  // Listen for physical barcode scanner input
  useBarcodeScannerInput({
    onScan: handleBarcodeScan,
    minLength: 10, // Minimum chars to trigger (avoid accidental triggers)
    enabled: true,
  });

  const createCustomer = useCreateCustomer();
  const createWatch = useCreateWatch();

  const getModelsForBrand = (brand: string): readonly string[] => {
    if (brand === "Rolex" || brand === "Cellini") return ROLEX_MODELS;
    if (brand === "Tudor") return TUDOR_MODELS;
    return [];
  };

  const models = getModelsForBrand(form.brand);
  const isKnownBrand = WATCH_BRANDS.includes(form.brand as any);

  // Filter brand suggestions based on input
  const filteredBrands = form.brand.trim()
    ? WATCH_BRANDS.filter((brand) =>
        brand.toLowerCase().includes(form.brand.toLowerCase())
      )
    : WATCH_BRANDS;

  const canSubmit =
    form.name.trim().length > 0 &&
    form.brand.trim().length > 0 &&
    form.estimateNumber.trim().length > 0;

  const createCustomerAndWatch = async () => {
    // Create customer
    const newCustomer = await createCustomer.mutateAsync({
      name: form.name.trim(),
      email: form.email.trim() || null,
      created_by: session?.user?.id || null,
    });

    // Create watch
    const newWatch = await createWatch.mutateAsync({
      customer_id: newCustomer.id,
      brand: form.brand.trim(),
      model: form.model.trim() || null,
      reference_number: form.referenceNumber.trim() || null,
      estimate_number: form.estimateNumber.trim(),
      target_date: null,
    });

    return { customerId: newCustomer.id, watchId: newWatch.id };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await createCustomerAndWatch();
      toast.success("Customer and watch created successfully");
      navigate("/clients");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartInspection = async () => {
    if (!canSubmit) return;

    setIsStartingInspection(true);
    try {
      const { customerId, watchId } = await createCustomerAndWatch();
      toast.success("Customer and watch created");
      // Navigate to inspection with pre-filled data
      navigate(`/inspections/new?customerId=${customerId}&watchId=${watchId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create customer");
    } finally {
      setIsStartingInspection(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Customer</h1>
          <p className="text-xs text-muted-foreground">
            Add customer and watch details • <span className="text-primary">Scan QR label to auto-fill</span>
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4">
        {/* Customer Info */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Customer</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Watch Info */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Watch Details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Estimate Number */}
            <div className="space-y-1">
              <Label htmlFor="estimate-number" className="text-xs">Estimate # *</Label>
              <Input
                id="estimate-number"
                placeholder="e.g. EST-2024-001"
                value={form.estimateNumber}
                onChange={(e) => setForm({ ...form, estimateNumber: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            {/* Reference Number */}
            <div className="space-y-1">
              <Label htmlFor="reference-number" className="text-xs">Reference #</Label>
              <Input
                id="reference-number"
                placeholder="e.g. 16613-X930492"
                value={form.referenceNumber}
                onChange={(e) => {
                  const newRef = e.target.value;
                  const detected = detectWatchFromReference(newRef);
                  if (detected) {
                    setForm({ 
                      ...form, 
                      referenceNumber: newRef,
                      brand: detected.brand,
                      model: detected.model
                    });
                  } else {
                    setForm({ ...form, referenceNumber: newRef });
                  }
                }}
                className="h-8 text-sm"
              />
            </div>

            {/* Brand */}
            <div className="space-y-1 relative">
              <Label className="text-xs">Brand *</Label>
              <Input
                placeholder="Type brand name..."
                value={form.brand}
                onChange={(e) => {
                  setForm({ ...form, brand: e.target.value, model: "" });
                  setShowBrandSuggestions(true);
                }}
                onFocus={() => setShowBrandSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowBrandSuggestions(false), 150);
                }}
                className="h-8 text-sm"
              />
              {showBrandSuggestions && filteredBrands.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-40 overflow-y-auto">
                  {filteredBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className={cn(
                        "flex w-full items-center px-2 py-1.5 text-xs hover:bg-accent",
                        form.brand === brand && "bg-accent"
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm({ ...form, brand, model: "" });
                        setShowBrandSuggestions(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          form.brand === brand ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {brand}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model */}
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              {isKnownBrand && models.length > 0 ? (
                <Popover open={modelOpen} onOpenChange={setModelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-8 text-sm"
                    >
                      {form.model || "Select model…"}
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search model…" className="h-8 text-sm" />
                      <CommandList>
                        <CommandEmpty>No model found.</CommandEmpty>
                        <CommandGroup>
                          {models.map((model) => (
                            <CommandItem
                              key={model}
                              value={model}
                              onSelect={() => {
                                setForm({ ...form, model });
                                setModelOpen(false);
                              }}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-3 w-3",
                                  form.model === model ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {model}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  placeholder="Enter model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="h-8 text-sm"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/clients")}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={!canSubmit || isSubmitting || isStartingInspection}>
              {isSubmitting ? "Creating…" : "Save Customer"}
            </Button>
            <Button 
              type="button" 
              size="sm"
              disabled={!canSubmit || isSubmitting || isStartingInspection}
              onClick={handleStartInspection}
            >
              {isStartingInspection ? "Starting…" : "Start Inspection"}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
};

export default NewCustomer;
