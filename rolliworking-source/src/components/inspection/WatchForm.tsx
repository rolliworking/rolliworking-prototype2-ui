import * as React from "react";
import { Check, ChevronsUpDown, BookmarkPlus } from "lucide-react";

import { cn } from "@/lib/utils";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  WATCH_BRANDS,
  ROLEX_MODELS,
  TUDOR_MODELS,
} from "@/hooks/use-watches";
import { detectWatchFromReference } from "@/lib/watch-constants";
import {
  useCheckReferenceExists,
  useAddModelReference,
  lookupReferenceInDatabase,
} from "@/hooks/use-model-references";

type WatchFormData = {
  brand: string;
  model: string;
  referenceNumber: string;
  estimateNumber: string;
};

interface WatchFormProps {
  value: WatchFormData;
  onChange: (value: WatchFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WatchForm({ value, onChange, onNext, onBack }: WatchFormProps) {
  const [modelOpen, setModelOpen] = React.useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [pendingSave, setPendingSave] = React.useState<{
    partNumber: string;
    brand: string;
    model: string;
  } | null>(null);

  const checkReference = useCheckReferenceExists();
  const addReference = useAddModelReference();

  const getModelsForBrand = (brand: string): readonly string[] => {
    if (brand === "Rolex" || brand === "Cellini") return ROLEX_MODELS;
    if (brand === "Tudor") return TUDOR_MODELS;
    return [];
  };

  const models = getModelsForBrand(value.brand);
  const isKnownBrand = WATCH_BRANDS.includes(value.brand as any);

  // Filter brand suggestions based on input
  const filteredBrands = value.brand.trim()
    ? WATCH_BRANDS.filter((brand) =>
        brand.toLowerCase().includes(value.brand.toLowerCase())
      )
    : WATCH_BRANDS;

  const canProceed =
    value.brand.trim().length > 0 && value.estimateNumber.trim().length > 0;

  // Check if we should prompt to save when user has entered ref + brand + model
  const checkAndPromptSave = React.useCallback(async () => {
    if (!value.referenceNumber || !value.brand) return;

    const refPart = value.referenceNumber.split("-")[0].trim();
    if (!refPart) return;

    // Check if reference already exists in database
    const existing = await checkReference.mutateAsync(refPart);
    
    if (!existing) {
      // Reference not in library - prompt to save
      setPendingSave({
        partNumber: refPart,
        brand: value.brand,
        model: value.model,
      });
      setShowSaveDialog(true);
    }
  }, [value.referenceNumber, value.brand, value.model, checkReference]);

  // Handle reference number change with database lookup
  const handleReferenceChange = async (newRef: string) => {
    // First try local constants
    const detected = detectWatchFromReference(newRef);
    if (detected) {
      onChange({
        ...value,
        referenceNumber: newRef,
        // Only auto-fill if currently empty
        brand: value.brand.trim() ? value.brand : detected.brand,
        model: value.model.trim() ? value.model : detected.model,
      });
      return;
    }

    // Then try database lookup (only if brand/model empty)
    if (!value.brand.trim() || !value.model.trim()) {
      const dbMatch = await lookupReferenceInDatabase(newRef);
      if (dbMatch) {
        onChange({
          ...value,
          referenceNumber: newRef,
          brand: value.brand.trim() ? value.brand : dbMatch.brand,
          model: value.model.trim() ? value.model : dbMatch.model,
        });
        return;
      }
    }

    // No match - just update reference
    onChange({ ...value, referenceNumber: newRef });
  };

  const handleSaveToLibrary = () => {
    if (pendingSave) {
      addReference.mutate({
        partNumber: pendingSave.partNumber,
        brand: pendingSave.brand,
        model: pendingSave.model,
      });
    }
    setShowSaveDialog(false);
    setPendingSave(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Estimate Number */}
        <div className="space-y-2">
          <Label htmlFor="estimate-number">Estimate # *</Label>
          <Input
            id="estimate-number"
            placeholder="e.g. EST-2024-001"
            value={value.estimateNumber}
            onChange={(e) =>
              onChange({ ...value, estimateNumber: e.target.value })
            }
          />
        </div>

        {/* Reference Number */}
        <div className="space-y-2">
          <Label htmlFor="reference-number">Reference #</Label>
          <Input
            id="reference-number"
            placeholder="e.g. 126610LN"
            value={value.referenceNumber}
            onChange={(e) => handleReferenceChange(e.target.value)}
            onBlur={() => checkAndPromptSave()}
          />
        </div>

        {/* Brand */}
        <div className="space-y-2 relative">
          <Label>Brand *</Label>
          <Input
            placeholder="Type brand name..."
            value={value.brand}
            onChange={(e) => {
              onChange({ ...value, brand: e.target.value, model: "" });
              setShowBrandSuggestions(true);
            }}
            onFocus={() => setShowBrandSuggestions(true)}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowBrandSuggestions(false), 150);
            }}
          />
          {showBrandSuggestions && filteredBrands.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {filteredBrands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm hover:bg-accent",
                    value.brand === brand && "bg-accent"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ ...value, brand, model: "" });
                    setShowBrandSuggestions(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.brand === brand ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {brand}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label>Model</Label>
          {isKnownBrand && models.length > 0 ? (
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {value.model || "Select model…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search model…" />
                  <CommandList>
                    <CommandEmpty>No model found.</CommandEmpty>
                    <CommandGroup>
                      {models.map((model) => (
                        <CommandItem
                          key={model}
                          value={model}
                          onSelect={() => {
                            onChange({ ...value, model });
                            setModelOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value.model === model ? "opacity-100" : "opacity-0"
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
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              onBlur={() => checkAndPromptSave()}
            />
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>

      {/* Save to Library Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-primary" />
              Save to Reference Library?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This reference number isn't in your library yet. Would you like to
              save it for automatic detection in the future?
              <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                <div><strong>Reference:</strong> {pendingSave?.partNumber}</div>
                <div><strong>Brand:</strong> {pendingSave?.brand}</div>
                {pendingSave?.model && (
                  <div><strong>Model:</strong> {pendingSave?.model}</div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSave(null)}>
              No, skip
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveToLibrary}>
              Yes, save to library
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
