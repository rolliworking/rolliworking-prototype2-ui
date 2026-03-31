import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConditionSelector } from "./ConditionSelector";
import { QuickNoteSelector } from "./QuickNoteSelector";

export interface AdditionalNote {
  note: string;
  price?: number;
  addYesNo?: boolean;
}

export interface SectionConditionData {
  condition: string;
  selectedNotes: string[];
  customNote: string;
  customNotePrice?: number;
  customNoteAddYesNo?: boolean;
  price?: number;
  waiverRequired?: boolean;
  additionalNotes?: AdditionalNote[];
}

interface InspectionSectionProps {
  title: string;
  sectionKey: string; // e.g., "dial", "hands", "bezel" - used for storing custom notes
  icon?: React.ReactNode;
  value: SectionConditionData;
  onChange: (value: SectionConditionData) => void;
  predefinedNotes: string[];
  showPrice?: boolean;
  showWaiver?: boolean;
  additionalPriceFields?: {
    label: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    addYesNo?: boolean;
    onYesNoChange?: (value: boolean) => void;
  }[];
  defaultOpen?: boolean;
  showCustomNotePrice?: boolean;
  className?: string;
  afterCondition?: React.ReactNode;
}

export function InspectionSection({
  title,
  sectionKey,
  icon,
  value,
  onChange,
  predefinedNotes,
  showPrice = true,
  showWaiver = false,
  additionalPriceFields = [],
  defaultOpen = true,
  showCustomNotePrice = false,
  className,
  afterCondition,
}: InspectionSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const hasContent = value.condition || value.selectedNotes.length > 0 || value.customNote || value.price;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("transition-all", hasContent && "border-primary/30", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                {icon}
                {title}
                {hasContent && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 px-3 pb-3 pt-0">
            {/* Condition Selector */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Condition</Label>
              <ConditionSelector
                value={value.condition}
                onChange={(condition) => onChange({ ...value, condition })}
              />
            </div>

            {/* Optional content after condition */}
            {afterCondition}

            {/* Quick Notes */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <QuickNoteSelector
                selectedNotes={value.selectedNotes}
                customNote={value.customNote}
                customNotePrice={value.customNotePrice}
                customNoteAddYesNo={value.customNoteAddYesNo}
                waiverRequired={value.waiverRequired || false}
                additionalNotes={value.additionalNotes || []}
                onNotesChange={(selectedNotes) => onChange({ ...value, selectedNotes })}
                onCustomNoteChange={(customNote) => onChange({ ...value, customNote })}
                onCustomNotePriceChange={(customNotePrice) => onChange({ ...value, customNotePrice })}
                onCustomNoteAddYesNoChange={(customNoteAddYesNo) => onChange({ ...value, customNoteAddYesNo })}
                onWaiverChange={(waiverRequired) => onChange({ ...value, waiverRequired })}
                onAdditionalNotesChange={(additionalNotes) => onChange({ ...value, additionalNotes })}
                predefinedNotes={predefinedNotes}
                sectionKey={sectionKey}
                showWaiver={showWaiver}
                showCustomNotePrice={showCustomNotePrice}
              />
            </div>

            {/* Price Field */}
            {showPrice && (
              <div className="space-y-1">
                <Label htmlFor={`${title}-price`} className="text-xs text-muted-foreground">
                  Price ($)
                </Label>
                <Input
                  id={`${title}-price`}
                  type="number"
                  min={0}
                  value={value.price ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, price: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="0"
                  className="h-8 w-28 text-sm"
                />
              </div>
            )}

            {/* Additional Price Fields */}
            {additionalPriceFields.map((field, index) => (
              <div key={index} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="0"
                    className="h-8 w-28 text-sm"
                  />
                  {field.value != null && field.value > 0 && field.onYesNoChange && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <Checkbox
                        checked={!!field.addYesNo}
                        onCheckedChange={(checked) => field.onYesNoChange?.(!!checked)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">Yes/No</span>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export const emptySectionCondition = (): SectionConditionData => ({
  condition: "",
  selectedNotes: [],
  customNote: "",
  customNotePrice: undefined,
  customNoteAddYesNo: false,
  price: undefined,
  waiverRequired: false,
  additionalNotes: [],
});
