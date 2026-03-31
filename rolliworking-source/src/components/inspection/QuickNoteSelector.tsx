import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, X, Save } from "lucide-react";
import { useCustomNotes, useAddCustomNote } from "@/hooks/use-custom-notes";
import { useNoteUsage } from "@/hooks/use-note-usage";
import type { AdditionalNote } from "./InspectionSection";

interface QuickNoteSelectorProps {
  selectedNotes: string[];
  customNote: string;
  customNotePrice?: number;
  customNoteAddYesNo?: boolean;
  waiverRequired: boolean;
  additionalNotes?: AdditionalNote[];
  onNotesChange: (notes: string[]) => void;
  onCustomNoteChange: (note: string) => void;
  onCustomNotePriceChange?: (price: number | undefined) => void;
  onCustomNoteAddYesNoChange?: (addYesNo: boolean) => void;
  onWaiverChange: (required: boolean) => void;
  onAdditionalNotesChange?: (notes: AdditionalNote[]) => void;
  predefinedNotes: string[];
  sectionKey: string; // e.g., "dial", "hands", "bezel"
  showWaiver?: boolean;
  showCustomNotePrice?: boolean;
  className?: string;
}

export function QuickNoteSelector({
  selectedNotes,
  customNote,
  customNotePrice,
  customNoteAddYesNo,
  waiverRequired,
  additionalNotes = [],
  onNotesChange,
  onCustomNoteChange,
  onCustomNotePriceChange,
  onCustomNoteAddYesNoChange,
  onWaiverChange,
  onAdditionalNotesChange,
  predefinedNotes,
  sectionKey,
  showWaiver = false,
  showCustomNotePrice = false,
  className,
}: QuickNoteSelectorProps) {
  // Fetch custom notes for this section
  const { data: customNotes = [] } = useCustomNotes(sectionKey);
  const addCustomNote = useAddCustomNote();
  
  // Fetch usage data to determine top 3 notes
  const { data: usageData = [] } = useNoteUsage(sectionKey);
  
  // Get top 3 most used notes for this section
  const topNotes = React.useMemo(() => {
    return usageData
      .slice(0, 3)
      .map((u) => u.note);
  }, [usageData]);

  // Combine predefined and custom notes, preserving predefined order (matches scantron sheet numbering)
  const allNotes = React.useMemo(() => {
    const predefinedSet = new Set(predefinedNotes);
    const customNoteTexts = customNotes
      .map((cn) => cn.note)
      .filter((note) => !predefinedSet.has(note));
    return [...predefinedNotes, ...customNoteTexts];
  }, [predefinedNotes, customNotes]);

  const toggleNote = (note: string) => {
    if (selectedNotes.includes(note)) {
      onNotesChange(selectedNotes.filter((n) => n !== note));
    } else {
      onNotesChange([...selectedNotes, note]);
    }
  };

  const handleSaveToLibrary = () => {
    const trimmed = customNote.trim();
    if (!trimmed) return;
    addCustomNote.mutate(
      { section: sectionKey, note: trimmed },
      {
        onSuccess: () => {
          // Clear the custom note input after saving
          onCustomNoteChange("");
        },
      }
    );
  };

  const addNewNote = () => {
    onAdditionalNotesChange?.([...additionalNotes, { note: "", price: undefined, addYesNo: false }]);
  };

  const updateNote = (index: number, updates: Partial<AdditionalNote>) => {
    const updated = additionalNotes.map((n, i) => (i === index ? { ...n, ...updates } : n));
    onAdditionalNotesChange?.(updated);
  };

  const removeNote = (index: number) => {
    onAdditionalNotesChange?.(additionalNotes.filter((_, i) => i !== index));
  };

  const canSaveToLibrary = customNote.trim().length > 0 && !allNotes.includes(customNote.trim());

  return (
    <div className={cn("space-y-3", className)}>
      {/* Predefined Notes - List View */}
      <div className="rounded-md border border-border/50 bg-muted/20">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px">
          {allNotes.map((note, idx) => {
            const isTopNote = topNotes.includes(note);
            return (
              <label
                key={note}
                onClick={() => toggleNote(note)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors hover:bg-muted/50",
                  selectedNotes.includes(note) && "bg-primary/10",
                  idx < allNotes.length - (allNotes.length % 3 || 3) && "border-b border-border/30"
                )}
              >
                <span className={cn(
                  "flex-shrink-0 w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center",
                  selectedNotes.includes(note)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  {idx + 1}
                </span>
                <span className={cn("text-xs leading-tight", isTopNote && "font-bold")}>{note}</span>
              </label>
            );
          })}
          {/* Manual Entry Box with Save Button */}
          <div
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 col-span-2 sm:col-span-3 border-t border-border/30"
            )}
          >
            <Input
              placeholder="Other..."
              value={customNote}
              onChange={(e) => onCustomNoteChange(e.target.value)}
              className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
            />
            {canSaveToLibrary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSaveToLibrary}
                disabled={addCustomNote.isPending}
                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                title="Save to library for future use"
              >
                <Save className="h-3 w-3" />
                Save
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Waiver Toggle */}
      {showWaiver && (
        <div className="flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
          <Checkbox
            id="waiver-toggle"
            checked={waiverRequired}
            onCheckedChange={(checked) => onWaiverChange(!!checked)}
          />
          <Label htmlFor="waiver-toggle" className="flex cursor-pointer items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Waiver Required
          </Label>
        </div>
      )}

      {/* Custom Note Price & Add Yes/No */}
      {showCustomNotePrice && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Price ($)</Label>
            <Input
              type="number"
              min={0}
              value={customNotePrice ?? ""}
              onChange={(e) => {
                const newPrice = e.target.value ? Number(e.target.value) : undefined;
                onCustomNotePriceChange?.(newPrice);
                // Auto-enable Yes/No when price is entered
                if (newPrice && newPrice > 0 && !customNoteAddYesNo) {
                  onCustomNoteAddYesNoChange?.(true);
                }
              }}
              placeholder="0"
              className="w-24 h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="add-yes-no"
              checked={customNoteAddYesNo || false}
              onCheckedChange={(checked) => onCustomNoteAddYesNoChange?.(!!checked)}
            />
            <Label htmlFor="add-yes-no" className="cursor-pointer text-sm">
              Add "Yes / No?" to summary
            </Label>
          </div>
        </div>
      )}

      {/* Additional Notes */}
      {additionalNotes.map((additionalNote, index) => (
        <div key={index} className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-2">
          <Input
            placeholder="Enter note..."
            value={additionalNote.note}
            onChange={(e) => updateNote(index, { note: e.target.value })}
            className="flex-1 text-sm h-8"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              value={additionalNote.price ?? ""}
              onChange={(e) => {
                const newPrice = e.target.value ? Number(e.target.value) : undefined;
                // Auto-enable Yes/No when price is entered
                if (newPrice && newPrice > 0 && !additionalNote.addYesNo) {
                  updateNote(index, { price: newPrice, addYesNo: true });
                } else {
                  updateNote(index, { price: newPrice });
                }
              }}
              placeholder="0"
              className="w-20 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id={`yes-no-${index}`}
              checked={additionalNote.addYesNo || false}
              onCheckedChange={(checked) => updateNote(index, { addYesNo: !!checked })}
            />
            <Label htmlFor={`yes-no-${index}`} className="cursor-pointer text-xs whitespace-nowrap">
              Yes/No?
            </Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeNote(index)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add Note Button */}
      {showCustomNotePrice && (
        <Button
          variant="outline"
          size="sm"
          onClick={addNewNote}
          className="gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Note
        </Button>
      )}
    </div>
  );
}