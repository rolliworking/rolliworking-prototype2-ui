import * as React from "react";
import { Save, X, ChevronDown, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UsedPart {
  id: string;
  part_number: string;
  added_at: string;
  synced_to_rollisuite: boolean;
}

interface UsedPartsSectionProps {
  jobId: string | null;
  usedParts: UsedPart[];
  onChange: (parts: UsedPart[]) => void;
  estimateNumber: string;
  watchBrand: string;
  watchModel: string;
  customerName?: string;
  disabled?: boolean;
}

export const UsedPartsSection: React.FC<UsedPartsSectionProps> = ({
  jobId,
  usedParts,
  onChange,
  estimateNumber,
  watchBrand,
  watchModel,
  customerName,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [bulkInput, setBulkInput] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Parse existing parts to display format
  const getDisplayValue = React.useCallback(() => {
    if (usedParts.length === 0) return "";
    return usedParts.map((p) => p.part_number).join("._");
  }, [usedParts]);

  // Handle editing mode
  const handleStartEdit = () => {
    setBulkInput(usedParts.length > 0 ? getDisplayValue() + "._" : "");
    setIsEditing(true);
    // Focus after render
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Handle barcode scan input - append separator after each entry
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = e.target.value;
    
    // If user types or scans and there's content, ensure separator format
    // Normalize multiple underscores or dots
    value = value.replace(/\.+_+/g, "._").replace(/_+\.+/g, "._");
    
    setBulkInput(value);
  };

  // Handle Enter key for barcode scanner (auto-append separator)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Append separator for next part
      const currentValue = bulkInput.trim();
      if (currentValue && !currentValue.endsWith("._")) {
        setBulkInput(currentValue + "._");
      }
    }
  };

  // Parse bulk input into parts array
  const parseBulkInput = (input: string): string[] => {
    // Split by ._ separator and clean up
    return input
      .split("._")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  };

  // Cancel editing
  const handleCancel = () => {
    setBulkInput("");
    setIsEditing(false);
  };

  // Save parts and sync to RolliSuite
  const handleSave = async () => {
    if (!jobId) {
      toast.error("Please save the job first before adding used parts");
      return;
    }

    const partNumbers = parseBulkInput(bulkInput);
    if (partNumbers.length === 0) {
      toast.error("No parts entered");
      return;
    }

    setIsSaving(true);

    try {
      // Create used parts array
      const newParts: UsedPart[] = partNumbers.map((pn) => ({
        id: crypto.randomUUID(),
        part_number: pn,
        added_at: new Date().toISOString(),
        synced_to_rollisuite: false,
      }));

      // Save to database
      const { error: dbError } = await supabase
        .from("jobs")
        .update({ 
          used_parts: newParts as unknown as import("@/integrations/supabase/types").Json 
        })
        .eq("id", jobId);

      if (dbError) throw dbError;

      // Sync to RolliSuite for allocation
      const partsPayload = partNumbers.map((pn) => ({
        part_name: pn,
        part_number: pn,
        quantity: 1,
      }));

      const { data: allocationResult, error: allocationError } = await supabase.functions.invoke(
        "rollisuite-part-allocation",
        {
          body: {
            parts: partsPayload,
            estimate_number: estimateNumber,
            customer_name: customerName,
            watch_brand: watchBrand,
            watch_model: watchModel,
            status: "allocated",
          },
        }
      );

      if (allocationError) {
        console.error("RolliSuite allocation error:", allocationError);
        toast.warning("Parts saved but failed to sync to inventory system");
      } else if (!allocationResult?.success) {
        console.error("RolliSuite allocation failed:", allocationResult);
        toast.warning("Parts saved but inventory sync returned an error");
      } else {
        // Mark parts as synced
        const syncedParts = newParts.map((p) => ({ ...p, synced_to_rollisuite: true }));
        await supabase
          .from("jobs")
          .update({ 
            used_parts: syncedParts as unknown as import("@/integrations/supabase/types").Json 
          })
          .eq("id", jobId);
        
        onChange(syncedParts);
        toast.success(`${partNumbers.length} part(s) saved and synced to inventory`);
      }

      onChange(newParts);
      setIsEditing(false);
      setBulkInput("");
    } catch (error) {
      console.error("Error saving used parts:", error);
      toast.error("Failed to save parts");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="py-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Used Parts
          </Label>
          {usedParts.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {usedParts.length} part{usedParts.length !== 1 ? "s" : ""} logged
            </span>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-2">
            {/* Saved parts display */}
            {usedParts.length > 0 && (
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-sm font-mono break-all">
                  {getDisplayValue()}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span className={usedParts.every(p => p.synced_to_rollisuite) ? "text-green-600" : "text-amber-600"}>
                    {usedParts.every(p => p.synced_to_rollisuite) 
                      ? "✓ Synced to inventory" 
                      : "⚠ Pending sync"}
                  </span>
                </div>
              </div>
            )}

            {/* Add/Edit button */}
            {!disabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    {usedParts.length > 0 ? "Edit Used Parts" : "Add Used Parts (Barcode Scanner)"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleStartEdit}>
                    {usedParts.length > 0 ? "Edit existing parts" : "Start scanning parts"}
                  </DropdownMenuItem>
                  {usedParts.length > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setBulkInput("");
                        setIsEditing(true);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                    >
                      Replace all parts
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Bulk input textarea */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Scan barcodes or type part numbers. Press Enter after each part.
              </Label>
              <Textarea
                ref={textareaRef}
                value={bulkInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="3135-311._3135-421._"
                className="font-mono text-sm min-h-[100px]"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Format: part#._part#._ (e.g., 3135-311._3135-421)
              </p>
            </div>

            {/* Preview */}
            {bulkInput && (
              <div className="p-2 rounded bg-muted/50 border">
                <p className="text-xs font-medium mb-1">Preview ({parseBulkInput(bulkInput).length} parts):</p>
                <div className="flex flex-wrap gap-1">
                  {parseBulkInput(bulkInput).map((pn, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 text-xs bg-background rounded border">
                      {pn}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Save/Cancel buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || parseBulkInput(bulkInput).length === 0}
                className="flex-1"
              >
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Save & Sync to Inventory
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
