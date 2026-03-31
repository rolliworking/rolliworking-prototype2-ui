import * as React from "react";
import { addDays, format } from "date-fns";
import { 
  Circle, 
  Watch, 
  Crown, 
  Gem, 
  SquareStack, 
  Cog, 
  CircleDot,
  RotateCcw,
  Plus,
  Minus,
  CalendarIcon,
  ChevronDown
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateLocal, resolveTargetDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { INSPECTION_TYPES } from "@/hooks/use-inspections";
import { InspectionSection, type SectionConditionData, emptySectionCondition } from "./InspectionSection";
import { BraceletRepairOptions, type BraceletRepairData, emptyBraceletRepairData } from "./BraceletRepairOptions";
import { InspectionReport } from "./InspectionReport";
import { detectWatchFromReference } from "@/lib/watch-constants";
import { lookupReferenceInDatabase } from "@/hooks/use-model-references";

// Job type options with suggested weeks (for complete watch)
// LV2 variants add 4 weeks to standard, chrono is 8 weeks base
export const JOB_TYPES = [
  { value: "modern_movement", label: "Modern Movement Service", weeks: 4 },
  { value: "modern_lv2", label: "Modern LV2", weeks: 8 },
  { value: "vintage_movement", label: "Vintage Movement Service", weeks: 12 },
  { value: "vintage_lv2", label: "Vintage LV2", weeks: 16 },
  { value: "antique_movement", label: "Antique Movement Service", weeks: 27 },
  { value: "antique_lv2", label: "Antique LV2", weeks: 31 },
  { value: "chrono", label: "Chronograph", weeks: 8 },
  { value: "chrono_lv2", label: "Chronograph LV2", weeks: 12 },
  { value: "case_work", label: "Case Work", weeks: 4 },
  { value: "small_job", label: "Small Job", weeks: 2 },
  { value: "warranty", label: "Warranty", weeks: 4 },
  { value: "bracelet_work", label: "Bracelet Work", weeks: 3 },
  { value: "other", label: "Other", weeks: undefined },
] as const;

// Job type options for bracelet only inspections
export const BRACELET_JOB_TYPES = [
  { value: "stretch_repair", label: "Stretch Repair", weeks: 4 },
  { value: "small_job", label: "Small Job", weeks: 2 },
  { value: "partial_job", label: "Partial Job", weeks: 3 },
] as const;

// Predefined notes for each section
const DIAL_NOTES = [
  "Some Paint Defects",
  "Lume Shedding",
  "Scuffs on Hour Markers",
  "Chips along edge",
  "Moisture Damage",
  "No Defects to Note",
  "No Major Defects",
  "Aftermarket (not made by Rolex)",
  "Tritium",
  "Luminova",
];
const HANDS_NOTES = [
  "Scuffs",
  "Light Scratches",
  "Lume Shedding",
  "Hands Bent",
  "No Defects to Note",
  "No Major Defects",
  "Aftermarket (not made by Rolex)",
  "Tritium",
  "Luminova",
];
const BEZEL_NOTES = [
  "Scuffs",
  "Scuffs on steel ring",
  "Scuffs on gold ring",
  "Scuffs on insert",
  "Soft Flutes",
  "No Defects to Note",
  "No Major Defects",
  "Normal Wear",
  "Aftermarket (not made by Rolex)",
  "Recut Bezel + Welding?",
];
const CROWN_NOTES = [
  "Scuffs",
  "No Defects to Note",
  "No Major Defects",
  "Not threading properly",
  "Coronet polished down",
  "Dented/Damaged",
  "Normal Wear",
  "Aftermarket (not made by Rolex)",
  "Catching on one thread. Might try new case tube $55",
];
const CASE_NOTES = [
  "Scuffs",
  "Normal Wear",
  "Some Nicks and Gashes",
  "Material Missing from Tips of Lugs (inner edge)",
  "Welding $140/hr",
];
const CRYSTAL_NOTES = [
  "Scuffs",
  "Chips (edge)",
  "Micro Chips (edge)",
  "Aftermarket (not made by Rolex)",
  "Polish Up $0 Yes / No?",
];
const BRACELET_NOTES = [
  "Scuffs",
  "No Defects to Note",
  "No Major Defects",
  "Some Stretch",
  "Coronet very faded",
  "Normal Wear",
  "Aftermarket (not made by Rolex)",
  "Gold too thin to repair w/o Mold Work",
  "Might be 1mm narrower (material loss)",
];

// Data for a single bracelet item in a multi-item estimate
export interface BraceletItemData {
  model: string;
  braceletCondition: SectionConditionData;
  braceletRepair: BraceletRepairData;
  watchHeadRestorePrice?: number;
  watchHeadRestoreAddYesNo?: boolean;
  gasketsPrice?: number;
  gasketsAddYesNo?: boolean;
  // Persisted IDs for re-save (update instead of duplicate create)
  savedWatchId?: string;
  savedInspectionId?: string;
}

export const emptyBraceletItem = (): BraceletItemData => ({
  model: "",
  braceletCondition: emptySectionCondition(),
  braceletRepair: emptyBraceletRepairData(),
  watchHeadRestorePrice: undefined,
  watchHeadRestoreAddYesNo: false,
  gasketsPrice: undefined,
  gasketsAddYesNo: false,
});

export interface ExpandedInspectionFormData {
  inspectionType: string;
  jobType: string;
  jobTypes: string[]; // All service codes/job types from the label
  
  // Section conditions
  dialCondition: SectionConditionData;
  handsCondition: SectionConditionData;
  bezelCondition: SectionConditionData;
  crownCondition: SectionConditionData;
  caseCondition: SectionConditionData;
  crystalCondition: SectionConditionData;
  braceletCondition: SectionConditionData;
  
  // Additional pricing
  weldingPrice?: number;
  caseRestorePrice?: number;
  caseRestoreAddYesNo?: boolean;
  watchHeadRestorePrice?: number;
  watchHeadRestoreAddYesNo?: boolean;
  gasketsPrice?: number;
  gasketsAddYesNo?: boolean;
  
  // Retail polish (Case section)
  retailPolish?: boolean;
  
  // Crystal polish
  crystalPolishPrice?: number;
  crystalPolishApproved?: boolean;
  
  // Bracelet repair details
  braceletRepair: BraceletRepairData;
  
  // Multi-item bracelet array (used when totalItems > 1 and bracelet_only)
  braceletItems?: BraceletItemData[];
  
  // Misc
  miscNotes: string;
  miscNotesPrice?: number;
  miscNotesAddYesNo?: boolean;
  waiverRequired: boolean;
  waiverSigned: boolean;
  
  // Target date
  weeksToTarget: number;
  customTargetDate?: string; // ISO date string for manual override
  
  // Department tags: W=Watch, B=Bracelet, P=Polish, PM=Precious Metal (multi-select)
  departmentTags?: Array<"W" | "B" | "P" | "PM" | "SJ">;
  
  // Multi-item estimate numbering (e.g. "1 of 5")
  totalItems?: number;
  currentItemNumber?: number;
  
  // Calculated
  totalEstimate: number;
}

export type WatchFormData = {
  brand: string;
  model: string;
  referenceNumber: string;
  estimateNumber: string;
};

interface InspectionFormProps {
  value: ExpandedInspectionFormData;
  onChange: (value: ExpandedInspectionFormData) => void;
  onSubmit: () => void;
  onBack: () => void;
  onClear: () => void;
  onEmailSent?: () => void;
  onSaveForApproval?: () => Promise<string>;
  onResetAfterApproval?: () => void;
  isSubmitting: boolean;
  customerName: string;
  customerEmail: string;
  watchData: WatchFormData;
  onWatchChange: (data: WatchFormData) => void;
  useHtmlEmail?: boolean;
  onUseHtmlEmailChange?: (value: boolean) => void;
  inspectionId?: string | null;
  /** Original target date from DB (YYYY-MM-DD) for edit mode — prevents date drift */
  originalTargetDate?: string | null;
  /** The weeks-to-target value as loaded from DB, used as baseline for delta calculations */
  loadedWeeksToTarget?: number | null;
}

const HOURLY_RATE = 98;

export function InspectionForm({
  value,
  onChange,
  onSubmit,
  onBack,
  onClear,
  onEmailSent,
  onSaveForApproval,
  onResetAfterApproval,
  isSubmitting,
  customerName,
  customerEmail,
  watchData,
  onWatchChange,
  useHtmlEmail = false,
  onUseHtmlEmailChange,
  inspectionId,
  originalTargetDate,
  loadedWeeksToTarget,
}: InspectionFormProps) {
  const [showBrandSuggestions, setShowBrandSuggestions] = React.useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = React.useState(false);
  const brandInputRef = React.useRef<HTMLInputElement>(null);

  const BRAND_SUGGESTIONS = ["Rolex", "Tudor", "Cellini"];
  
  const MODEL_SUGGESTIONS = [
    "908 (Perpetual 1908)", "Air-King", "Air-Giant", "Air-Lion", "Air-Tiger",
    "Bubbleback", "Cellini", "Cosmograph Daytona", "Datejust", "Day-Date (President)",
    "Deepsea", "Deepsea Challenge", "Explorer", "Explorer II", "GMT-Master",
    "GMT-Master II", "King Midas", "Lady-Datejust", "Land-Dweller", "Milgauss",
    "Oyster Perpetual", "Oysterquartz", "Pearlmaster", "Prince", "Sea-Dweller",
    "Sky-Dweller", "Submariner", "Submariner Date", "Tru-Beat", "Turn-O-Graph (Thunderbird)",
    "Veriflat", "Yacht-Master", "Yacht-Master II",
    "1926", "1926 Luna", "Advisor", "Aeronaut", "Big Block", "Black Bay",
    "Black Bay 31/36/39/41", "Black Bay 54", "Black Bay 58", "Black Bay 68",
    "Black Bay Ceramic", "Black Bay Chrono", "Black Bay GMT", "Black Bay P01",
    "Black Bay Pro", "Clair de Rose", "Fastrider", "Fastrider Black Shield",
    "Glamour", "Grantour", "Heritage Chrono", "Hydronaut", "Hydronaut II",
    "Iconaut", "Monte Carlo", "North Flag", "Oyster", "Oysterdate", "Oyster Prince",
    "Oyster Prince Date+Day", "Pelagos", "Pelagos 39", "Pelagos FXD", "Pelagos Ultra",
    "Prince Quartz", "Ranger", "Royal", "Style"
  ];
  
  // Bracelet model suggestions
  const BRACELET_MODEL_SUGGESTIONS = ["Jubilee", "Oyster", "President", "Oysterquartz"];
  
  const filteredBraceletModels = BRACELET_MODEL_SUGGESTIONS.filter(
    (model) => 
      watchData.model.length > 0 && 
      model.toLowerCase().includes(watchData.model.toLowerCase()) &&
      model.toLowerCase() !== watchData.model.toLowerCase()
  );
  
  const filteredBrands = BRAND_SUGGESTIONS.filter(
    (brand) => 
      watchData.brand.length > 0 && 
      brand.toLowerCase().startsWith(watchData.brand.toLowerCase()) &&
      brand.toLowerCase() !== watchData.brand.toLowerCase()
  );

  const filteredModels = MODEL_SUGGESTIONS.filter(
    (model) => 
      watchData.model.length > 0 && 
      model.toLowerCase().includes(watchData.model.toLowerCase()) &&
      model.toLowerCase() !== watchData.model.toLowerCase()
  ).slice(0, 8); // Limit to 8 suggestions

  // Calculate target date with stable local-date logic shared with save path
  // Use loadedWeeksToTarget from parent (NewInspection) as the stable baseline
  const targetDate = React.useMemo(() => {
    return resolveTargetDate({
      customTargetDate: value.customTargetDate,
      originalTargetDate,
      initialWeeksToTarget: loadedWeeksToTarget ?? null,
      weeksToTarget: value.weeksToTarget,
    });
  }, [value.weeksToTarget, value.customTargetDate, originalTargetDate, loadedWeeksToTarget]);

  const handleDateAdjust = (days: number) => {
    if (!targetDate) return;
    const newDate = addDays(targetDate, days);
    onChange({ ...value, customTargetDate: formatDateLocal(newDate) });
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...value, customTargetDate: formatDateLocal(date) });
    }
  };

  const clearCustomDate = () => {
    onChange({ ...value, customTargetDate: undefined });
  };
  
  const isBraceletOnly = value.inspectionType === "bracelet_only";

  // Helper to sum additional notes prices
  const sumAdditionalNotes = (notes: typeof value.dialCondition.additionalNotes) => {
    return (notes || []).reduce((sum, n) => sum + (n.price || 0), 0);
  };

  // Calculate total estimate
  const totalEstimate = React.useMemo(() => {
    let total = 0;
    
    // Section prices
    if (!isBraceletOnly) {
      total += value.dialCondition.price || 0;
      total += value.dialCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.dialCondition.additionalNotes);
      total += value.handsCondition.price || 0;
      total += value.handsCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.handsCondition.additionalNotes);
      total += value.bezelCondition.price || 0;
      total += value.bezelCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.bezelCondition.additionalNotes);
      total += value.crownCondition.price || 0;
      total += value.crownCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.crownCondition.additionalNotes);
      total += value.caseCondition.price || 0;
      total += value.caseCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.caseCondition.additionalNotes);
      total += value.crystalCondition.price || 0;
      total += value.crystalCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.crystalCondition.additionalNotes);
      total += value.weldingPrice || 0;
      total += value.caseRestorePrice || 0;
    }
    
    // Bracelet - handle multi-item mode
    const isMultiItem = isBraceletOnly && value.braceletItems && value.braceletItems.length > 1;
    
    if (isMultiItem) {
      // Sum across all bracelet items
      for (const item of value.braceletItems!) {
        total += item.braceletCondition.price || 0;
        total += item.braceletCondition.customNotePrice || 0;
        total += sumAdditionalNotes(item.braceletCondition.additionalNotes);
        
        const br = item.braceletRepair;
        if (br.steelSideShowYesNo) total += (parseFloat(br.steelSideHours) || 0) * HOURLY_RATE;
        if (br.steelCenterShowYesNo) total += (parseFloat(br.steelCenterHours) || 0) * HOURLY_RATE;
        if (br.goldCenterShowYesNo) total += br.goldCenterPieces * br.goldCenterPricePerPiece;
        if (br.shorterLinksShowYesNo) total += br.shorterLinksQty * br.shorterLinksPrice;
        if (br.invertPiecesShowYesNo) total += br.invertPiecesQty * br.invertPricePerPiece;
        
        total += item.watchHeadRestorePrice || 0;
        total += item.gasketsPrice || 0;
      }
    } else {
      total += value.braceletCondition.price || 0;
      total += value.braceletCondition.customNotePrice || 0;
      total += sumAdditionalNotes(value.braceletCondition.additionalNotes);
      
      // Bracelet repair - add items with ShowYesNo enabled
      const br = value.braceletRepair;
      if (br.steelSideShowYesNo) total += (parseFloat(br.steelSideHours) || 0) * HOURLY_RATE;
      if (br.steelCenterShowYesNo) total += (parseFloat(br.steelCenterHours) || 0) * HOURLY_RATE;
      if (br.goldCenterShowYesNo) total += br.goldCenterPieces * br.goldCenterPricePerPiece;
      if (br.shorterLinksShowYesNo) total += br.shorterLinksQty * br.shorterLinksPrice;
      if (br.invertPiecesShowYesNo) total += br.invertPiecesQty * br.invertPricePerPiece;
      
      // Bracelet-only specific
      if (isBraceletOnly) {
        total += value.watchHeadRestorePrice || 0;
        total += value.gasketsPrice || 0;
      }
    }
    
    return total;
  }, [value, isBraceletOnly]);

  // Update total estimate when it changes - use ref to avoid infinite loop
  const prevTotalRef = React.useRef(value.totalEstimate);
  React.useEffect(() => {
    if (prevTotalRef.current !== totalEstimate) {
      prevTotalRef.current = totalEstimate;
      onChange({ ...value, totalEstimate });
    }
  }, [totalEstimate, onChange, value]);

  // Auto-sync waiver required from dial or hands sections
  const hasWaiverFromSections = value.dialCondition.waiverRequired || value.handsCondition.waiverRequired;

  // Keep top-level waiverRequired in sync with section checkboxes
  const prevHasWaiverFromSections = React.useRef(hasWaiverFromSections);
  React.useEffect(() => {
    // When a section waiver is newly checked, set top-level to true
    if (hasWaiverFromSections && !value.waiverRequired) {
      onChange({ ...value, waiverRequired: true });
    }
    // When all section waivers are unchecked (and they were previously checked), clear top-level
    if (!hasWaiverFromSections && prevHasWaiverFromSections.current && value.waiverRequired) {
      onChange({ ...value, waiverRequired: false, waiverSigned: false });
    }
    prevHasWaiverFromSections.current = hasWaiverFromSections;
  }, [hasWaiverFromSections]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = value.inspectionType.length > 0 && watchData.brand.trim().length > 0 && watchData.estimateNumber.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Customer Info Summary */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium truncate">{customerName || "No customer"}</span>
          {customerEmail ? (
            <span className="text-xs text-muted-foreground truncate">{customerEmail}</span>
          ) : (
            <span className="text-xs text-destructive">No email — can't send notes</span>
          )}
        </div>
        {watchData.estimateNumber && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">Est #{watchData.estimateNumber}</span>
        )}
      </div>

      {/* Watch Details */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Watch Details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Brand */}
          <div className="space-y-1 relative">
            <Label htmlFor="brand" className="text-xs">Brand *</Label>
            <Input
              ref={brandInputRef}
              id="brand"
              placeholder="e.g. Rolex"
              value={watchData.brand}
              onChange={(e) => {
                onWatchChange({ ...watchData, brand: e.target.value });
                setShowBrandSuggestions(true);
              }}
              onFocus={() => setShowBrandSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowBrandSuggestions(false), 150);
              }}
              autoComplete="off"
              className="h-8"
            />
            {showBrandSuggestions && filteredBrands.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md">
                {filteredBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onWatchChange({ ...watchData, brand });
                      setShowBrandSuggestions(false);
                    }}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1 relative">
            <Label htmlFor="model" className="text-xs">{isBraceletOnly ? "Bracelet Model" : "Model"}</Label>
            <Input
              id="model"
              placeholder={isBraceletOnly ? "e.g. Jubilee" : "e.g. Submariner"}
              value={watchData.model}
              onChange={(e) => {
                onWatchChange({ ...watchData, model: e.target.value });
                setShowModelSuggestions(true);
              }}
              onFocus={() => setShowModelSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowModelSuggestions(false), 150);
              }}
              autoComplete="off"
              className="h-8"
            />
            {showModelSuggestions && (isBraceletOnly ? filteredBraceletModels : filteredModels).length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                {(isBraceletOnly ? filteredBraceletModels : filteredModels).map((model) => (
                  <button
                    key={model}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onWatchChange({ ...watchData, model });
                      setShowModelSuggestions(false);
                    }}
                  >
                    {model}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reference Number - only show for complete watch */}
          {!isBraceletOnly && (
            <div className="space-y-1">
              <Label htmlFor="reference-number" className="text-xs">Reference Number</Label>
              <Input
                id="reference-number"
                placeholder="e.g. 126610LN"
                value={watchData.referenceNumber}
                onChange={(e) => {
                  const newRef = e.target.value;
                  const detected = detectWatchFromReference(newRef);
                  if (detected) {
                    onWatchChange({ 
                      ...watchData, 
                      referenceNumber: newRef,
                      // Only auto-fill brand/model if currently empty
                      brand: watchData.brand.trim() ? watchData.brand : detected.brand,
                      model: watchData.model.trim() ? watchData.model : detected.model,
                    });
                  } else {
                    onWatchChange({ ...watchData, referenceNumber: newRef });
                  }
                }}
                onBlur={async () => {
                  const ref = watchData.referenceNumber?.trim();
                  if (!ref) return;
                  // Only auto-fill from lookup if brand/model are empty
                  if (watchData.brand.trim() && watchData.model.trim()) return;
                  const detected = detectWatchFromReference(ref);
                  if (detected) {
                    onWatchChange({
                      ...watchData,
                      brand: watchData.brand.trim() ? watchData.brand : detected.brand,
                      model: watchData.model.trim() ? watchData.model : detected.model,
                    });
                    return;
                  }
                  const dbMatch = await lookupReferenceInDatabase(ref);
                  if (dbMatch) {
                    onWatchChange({
                      ...watchData,
                      brand: watchData.brand.trim() ? watchData.brand : dbMatch.brand,
                      model: watchData.model.trim() ? watchData.model : dbMatch.model,
                    });
                  }
                }}
                className="h-8"
              />
            </div>
          )}

          {/* Estimate Number */}
          <div className="space-y-1">
            <Label htmlFor="estimate-number" className="text-xs">Estimate Number *</Label>
            <Input
              id="estimate-number"
              placeholder="e.g. EST-2024-001"
              value={watchData.estimateNumber}
              onChange={(e) => onWatchChange({ ...watchData, estimateNumber: e.target.value })}
              className="h-8"
            />
          </div>

          {/* Target Weeks */}
          <div className="space-y-1">
            <Label htmlFor="weeks-to-target" className="text-xs">Target Weeks *</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                id="weeks-to-target"
                type="number"
                min={0}
                max={52}
                value={value.weeksToTarget || ""}
                onChange={(e) =>
                  onChange({ 
                    ...value, 
                    weeksToTarget: e.target.value ? Number(e.target.value) : 0,
                    customTargetDate: undefined
                  })
                }
                placeholder="0"
                className="h-8 w-16"
              />
              {targetDate && (
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">→</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDateAdjust(-7)}
                    title="Subtract 1 week"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-xs font-normal",
                          value.customTargetDate && "border-primary"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(targetDate, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={targetDate}
                        onSelect={handleCalendarSelect}
                        defaultMonth={targetDate || undefined}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDateAdjust(7)}
                    title="Add 1 week"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  {value.customTargetDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-muted-foreground"
                      onClick={clearCustomDate}
                      title="Reset to calculated date"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Department Tag Toggle Buttons (multi-select) */}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Department Tag</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { value: "W", label: "W", title: "Watch — Watchmaker Dept" },
                { value: "B", label: "B", title: "Bracelet — Bracelet Dept" },
                { value: "P", label: "P", title: "Polish — Case Work / Polish" },
                { value: "PM", label: "PM", title: "Precious Metal Bracelet" },
                { value: "SJ", label: "SJ", title: "Small Job" },
              ] as const).map((tag) => {
                const tags = value.departmentTags || [];
                const isActive = tags.includes(tag.value);
                return (
                  <Button
                    key={tag.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-7 px-3 text-xs font-bold min-w-[36px]",
                      isActive && tag.value === "PM" && "bg-amber-600 hover:bg-amber-700 border-amber-600",
                      isActive && tag.value === "SJ" && "bg-sky-600 hover:bg-sky-700 border-sky-600",
                    )}
                    title={tag.title}
                    onClick={() => {
                      let newTags: Array<"W" | "B" | "P" | "PM" | "SJ">;
                      if (isActive) {
                        newTags = tags.filter(t => t !== tag.value);
                      } else {
                        newTags = [...tags, tag.value];
                      }
                      // Update jobTypes based on PM tag
                      let updatedJobTypes = [...value.jobTypes];
                      updatedJobTypes = updatedJobTypes.filter(jt => jt !== "gold_bracelet");
                      if (newTags.includes("PM")) {
                        if (!updatedJobTypes.includes("gold_bracelet")) {
                          updatedJobTypes.push("gold_bracelet");
                        }
                      }
                      onChange({ ...value, departmentTags: newTags, jobTypes: updatedJobTypes });
                    }}
                  >
                    {tag.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">Auto-set from label scan. Override manually if needed.</p>
          </div>
        </div>
      </div>

      {/* Multiple Items - collapsible section for multi-item estimates */}
      {isBraceletOnly && (
        <Collapsible defaultOpen={!!value.totalItems && value.totalItems > 1}>
          <CollapsibleTrigger className="group flex items-center justify-between w-full py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
            <span>Multiple Items {value.totalItems && value.totalItems > 1 ? `(${value.totalItems} bracelets)` : ""}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-1 pb-2 space-y-2">
              <div className="space-y-1">
                <Label htmlFor="total-items" className="text-xs"># Total Items on this Estimate</Label>
                <Input
                  id="total-items"
                  type="number"
                  min={1}
                  max={99}
                  value={value.totalItems || ""}
                  onChange={(e) => {
                    const total = e.target.value ? Number(e.target.value) : undefined;
                    if (total && total > 1) {
                      // Initialize braceletItems array
                      const existingItems = value.braceletItems || [];
                      const items: BraceletItemData[] = [];
                      for (let i = 0; i < total; i++) {
                        items.push(existingItems[i] || emptyBraceletItem());
                      }
                      onChange({ ...value, totalItems: total, braceletItems: items, currentItemNumber: undefined });
                    } else {
                      onChange({ ...value, totalItems: total, braceletItems: undefined, currentItemNumber: undefined });
                    }
                  }}
                  placeholder="1"
                  className="h-8 w-24"
                />
              </div>
              {value.totalItems && value.totalItems > 1 && (
                <p className="text-xs text-muted-foreground">
                  {value.totalItems} bracelet sections will appear below. Each gets its own model and condition notes.
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Separator className="my-2" />
      {/* Type Selectors */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Inspection Type *</Label>
          <Select
            value={value.inspectionType}
            onValueChange={(v) => {
              if (v === "bracelet_only") {
                onChange({ 
                  ...value, 
                  inspectionType: v,
                  jobType: "stretch_repair",
                  weeksToTarget: 4,
                  braceletRepair: {
                    ...value.braceletRepair,
                    includeBandPolishQuestion: true,
                  }
                });
              } else {
                onChange({ 
                  ...value, 
                  inspectionType: v,
                  jobType: value.jobType || "",
                  weeksToTarget: INSPECTION_TYPES.find((t) => t.value === v)?.weeksToAdd || 8,
                  braceletRepair: {
                    ...value.braceletRepair,
                    includeBandPolishQuestion: false,
                  }
                });
              }
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {INSPECTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Job Type</Label>
          <Select
            value={value.jobType}
            onValueChange={(v) => {
              const jobTypeOptions = isBraceletOnly ? BRACELET_JOB_TYPES : JOB_TYPES;
              const selectedType = jobTypeOptions.find((t) => t.value === v);
              const suggestedWeeks = selectedType?.weeks;
              const updatedBraceletRepair = v === "case_work" 
                ? { ...value.braceletRepair, includeBandPolishQuestion: false }
                : value.braceletRepair;
              // Ensure the new jobType is included in the jobTypes array
              const updatedJobTypes = value.jobTypes.includes(v)
                ? value.jobTypes
                : [...value.jobTypes, v];
              onChange({ 
                ...value, 
                jobType: v,
                jobTypes: updatedJobTypes,
                weeksToTarget: suggestedWeeks ?? value.weeksToTarget,
                braceletRepair: updatedBraceletRepair
              });
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select job type…" />
            </SelectTrigger>
            <SelectContent>
              {(isBraceletOnly ? BRACELET_JOB_TYPES : JOB_TYPES).map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}{type.weeks ? ` (${type.weeks} wks)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Complete Watch Sections */}
      {!isBraceletOnly && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Watch Components</h3>
          
          <InspectionSection
            title="Dial"
            sectionKey="dial"
            icon={<Circle className="h-3.5 w-3.5" />}
            value={value.dialCondition}
            onChange={(v) => onChange({ ...value, dialCondition: v })}
            predefinedNotes={DIAL_NOTES}
            showPrice={false}
            showWaiver
            showCustomNotePrice
          />

          <InspectionSection
            title="Hands"
            sectionKey="hands"
            icon={<Watch className="h-3.5 w-3.5" />}
            value={value.handsCondition}
            onChange={(v) => onChange({ ...value, handsCondition: v })}
            predefinedNotes={HANDS_NOTES}
            showPrice={false}
            showWaiver
            showCustomNotePrice
          />

          <InspectionSection
            title="Bezel"
            sectionKey="bezel"
            icon={<CircleDot className="h-3.5 w-3.5" />}
            value={value.bezelCondition}
            onChange={(v) => onChange({ ...value, bezelCondition: v })}
            predefinedNotes={BEZEL_NOTES}
            showPrice={false}
            showCustomNotePrice
          />

          <InspectionSection
            title="Crown"
            sectionKey="crown"
            icon={<Crown className="h-3.5 w-3.5" />}
            value={value.crownCondition}
            onChange={(v) => onChange({ ...value, crownCondition: v })}
            predefinedNotes={CROWN_NOTES}
            showPrice={false}
            showCustomNotePrice
          />

          <InspectionSection
            title="Case"
            sectionKey="case"
            icon={<SquareStack className="h-3.5 w-3.5" />}
            value={value.caseCondition}
            onChange={(v) => onChange({ ...value, caseCondition: v })}
            predefinedNotes={CASE_NOTES}
            showPrice={false}
            showCustomNotePrice
            afterCondition={
              <div className="rounded-md border p-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={value.retailPolish === true}
                    onCheckedChange={(checked) => onChange({ ...value, retailPolish: !!checked })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium">Retail polish</span>
                </label>
              </div>
            }
            additionalPriceFields={[
              {
                label: "Retail Case Restoration",
                value: value.caseRestorePrice,
                onChange: (v) => onChange({ ...value, caseRestorePrice: v }),
                addYesNo: value.caseRestoreAddYesNo,
                onYesNoChange: (v) => onChange({ ...value, caseRestoreAddYesNo: v }),
              },
              {
                label: "Welding Price ($)",
                value: value.weldingPrice,
                onChange: (v) => onChange({ ...value, weldingPrice: v }),
              },
            ]}
          />

          <InspectionSection
            title="Crystal"
            sectionKey="crystal"
            icon={<Gem className="h-3.5 w-3.5" />}
            value={value.crystalCondition}
            onChange={(v) => onChange({ ...value, crystalCondition: v })}
            predefinedNotes={CRYSTAL_NOTES}
            showPrice={false}
            showCustomNotePrice
          />
          
          {/* Crystal Polish Option */}
          <div className="ml-3 rounded-md border p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">$</span>
                <input
                  type="number"
                  min={0}
                  value={value.crystalPolishPrice ?? 0}
                  onChange={(e) =>
                    onChange({ ...value, crystalPolishPrice: Number(e.target.value) || 0 })
                  }
                  className="flex h-7 w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
                />
                <span className="text-xs">to polish up</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={value.crystalPolishApproved === true}
                    onCheckedChange={(checked) => onChange({ ...value, crystalPolishApproved: !!checked })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium">YES</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={value.crystalPolishApproved === false}
                    onCheckedChange={(checked) => onChange({ ...value, crystalPolishApproved: !checked })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium">NO</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bracelet Section - multi-item or single */}
      {isBraceletOnly && value.braceletItems && value.braceletItems.length > 1 ? (
        // ─── MULTI-ITEM MODE ───
        <div className="space-y-4">
          {value.braceletItems.map((item, idx) => {
            const itemLabel = `${idx + 1} of ${value.braceletItems!.length}`;
            const updateItem = (updated: BraceletItemData) => {
              const newItems = [...value.braceletItems!];
              newItems[idx] = updated;
              onChange({ ...value, braceletItems: newItems });
            };
            return (
              <div key={idx} className="space-y-2 rounded-lg border-2 border-primary/20 p-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wide">
                    Bracelet {itemLabel}
                  </h3>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bracelet Model</Label>
                  <Input
                    placeholder="e.g. Jubilee"
                    value={item.model}
                    onChange={(e) => updateItem({ ...item, model: e.target.value })}
                    className="h-8"
                  />
                </div>

                <InspectionSection
                  title={`Condition (${itemLabel})`}
                  sectionKey={`bracelet-${idx}`}
                  icon={<Cog className="h-3.5 w-3.5" />}
                  value={item.braceletCondition}
                  onChange={(v) => updateItem({ ...item, braceletCondition: v })}
                  predefinedNotes={BRACELET_NOTES}
                  showPrice={false}
                  showCustomNotePrice
                />

                <BraceletRepairOptions
                  value={item.braceletRepair}
                  onChange={(v) => updateItem({ ...item, braceletRepair: v })}
                />

                <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Watch Head Restore ($)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={item.watchHeadRestorePrice ?? ""}
                        onChange={(e) => {
                          const newPrice = e.target.value ? Number(e.target.value) : undefined;
                          const hasValue = newPrice !== undefined && newPrice > 0;
                          updateItem({ 
                            ...item,
                            watchHeadRestorePrice: newPrice,
                            watchHeadRestoreAddYesNo: hasValue ? true : item.watchHeadRestoreAddYesNo
                          });
                        }}
                        placeholder="0"
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      {item.watchHeadRestorePrice !== undefined && item.watchHeadRestorePrice > 0 && (
                        <Button
                          type="button"
                          variant={item.watchHeadRestoreAddYesNo ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-[10px] px-2 shrink-0"
                          onClick={() => updateItem({ ...item, watchHeadRestoreAddYesNo: !item.watchHeadRestoreAddYesNo })}
                        >
                          Yes/No
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gaskets ($)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={item.gasketsPrice ?? ""}
                        onChange={(e) => {
                          const newPrice = e.target.value ? Number(e.target.value) : undefined;
                          const hasValue = newPrice !== undefined && newPrice > 0;
                          updateItem({ 
                            ...item,
                            gasketsPrice: newPrice,
                            gasketsAddYesNo: hasValue ? true : item.gasketsAddYesNo
                          });
                        }}
                        placeholder="0"
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      {item.gasketsPrice !== undefined && item.gasketsPrice > 0 && (
                        <Button
                          type="button"
                          variant={item.gasketsAddYesNo ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-[10px] px-2 shrink-0"
                          onClick={() => updateItem({ ...item, gasketsAddYesNo: !item.gasketsAddYesNo })}
                        >
                          Yes/No
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ─── SINGLE BRACELET MODE ───
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bracelet</h3>
          
          <InspectionSection
            title="Bracelet Condition"
            sectionKey="bracelet"
            icon={<Cog className="h-3.5 w-3.5" />}
            value={value.braceletCondition}
            onChange={(v) => onChange({ ...value, braceletCondition: v })}
            predefinedNotes={BRACELET_NOTES}
            showPrice={false}
            showCustomNotePrice
          />

          <BraceletRepairOptions
            value={value.braceletRepair}
            onChange={(v) => onChange({ ...value, braceletRepair: v })}
          />

          {/* Bracelet-only specific fields */}
          {isBraceletOnly && (
            <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Watch Head Restore Price ($)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={value.watchHeadRestorePrice ?? ""}
                    onChange={(e) => {
                      const newPrice = e.target.value ? Number(e.target.value) : undefined;
                      const hasValue = newPrice !== undefined && newPrice > 0;
                      onChange({ 
                        ...value, 
                        watchHeadRestorePrice: newPrice,
                        watchHeadRestoreAddYesNo: hasValue ? true : value.watchHeadRestoreAddYesNo
                      });
                    }}
                    placeholder="0"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  {value.watchHeadRestorePrice !== undefined && value.watchHeadRestorePrice > 0 && (
                    <Button
                      type="button"
                      variant={value.watchHeadRestoreAddYesNo ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => onChange({ ...value, watchHeadRestoreAddYesNo: !value.watchHeadRestoreAddYesNo })}
                    >
                      Yes/No
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gaskets Price ($)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={value.gasketsPrice ?? ""}
                    onChange={(e) => {
                      const newPrice = e.target.value ? Number(e.target.value) : undefined;
                      const hasValue = newPrice !== undefined && newPrice > 0;
                      onChange({ 
                        ...value, 
                        gasketsPrice: newPrice,
                        gasketsAddYesNo: hasValue ? true : value.gasketsAddYesNo
                      });
                    }}
                    placeholder="0"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  {value.gasketsPrice !== undefined && value.gasketsPrice > 0 && (
                    <Button
                      type="button"
                      variant={value.gasketsAddYesNo ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => onChange({ ...value, gasketsAddYesNo: !value.gasketsAddYesNo })}
                    >
                      Yes/No
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Separator className="my-2" />

      {/* Miscellaneous Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Inspection Notes</Label>

        {/* Quick-insert templates */}
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              label: "Low Amplitude / Pallet Fork",
              text: "Degrees of amplitude. This is very low. 240+ degrees of amplitude is normal. Might need a new Pallet fork but we will verify later $",
            },
          ].map((tpl) => {
            const isActive = value.miscNotes?.includes(tpl.text);
            return (
              <button
                key={tpl.label}
                type="button"
                onClick={() => {
                  if (isActive) return;
                  const current = value.miscNotes?.trim() || "";
                  const newText = current ? `${current}\n${tpl.text}` : tpl.text;
                  onChange({ ...value, miscNotes: newText });
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {tpl.label}
              </button>
            );
          })}
        </div>
        
        <div className="space-y-2">
          <Textarea
            id="misc-notes"
            placeholder="Any additional notes…"
            value={value.miscNotes}
            onChange={(e) => onChange({ ...value, miscNotes: e.target.value })}
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Price ($)</Label>
              <Input
                type="number"
                min={0}
                value={value.miscNotesPrice ?? ""}
                onChange={(e) =>
                  onChange({ ...value, miscNotesPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="0"
                className="h-7 w-20 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="misc-add-yes-no"
                checked={value.miscNotesAddYesNo || false}
                onCheckedChange={(checked) => onChange({ ...value, miscNotesAddYesNo: !!checked })}
                className="h-3.5 w-3.5"
              />
              <Label htmlFor="misc-add-yes-no" className="cursor-pointer text-xs">
                Add "Yes / No?" to summary
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Waiver Section */}
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="waiver-required"
            checked={value.waiverRequired}
            onCheckedChange={(checked) =>
              onChange({ ...value, waiverRequired: !!checked, waiverSigned: false })
            }
            className="h-3.5 w-3.5"
          />
          <Label htmlFor="waiver-required" className="cursor-pointer text-sm">
            Waiver required for this job
          </Label>
        </div>
        {value.waiverRequired && (
          <div className="flex items-center gap-2 pl-5">
            <Checkbox
              id="waiver-signed"
              checked={value.waiverSigned}
              onCheckedChange={(checked) =>
                onChange({ ...value, waiverSigned: !!checked })
              }
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="waiver-signed" className="cursor-pointer text-sm">
              Waiver has been signed
            </Label>
          </div>
        )}
      </div>

      {/* HTML Email Toggle removed — Send URL button is always available */}

      {/* Total Estimate */}
      <div className="flex justify-end rounded-md border border-primary/20 bg-primary/5 p-3">
        <p className="text-lg font-semibold">
          Total Estimate: <span className="text-primary">${totalEstimate.toLocaleString()}</span>
        </p>
      </div>

      {/* Report Preview */}
      {value.inspectionType && (
        <InspectionReport
          customerName={customerName}
          customerEmail={customerEmail}
          brand={watchData.brand}
          model={watchData.model}
          referenceNumber={watchData.referenceNumber}
          estimateNumber={watchData.estimateNumber}
          targetDate={targetDate}
          inspection={value}
          onEmailSent={onEmailSent}
          onSaveForApproval={onSaveForApproval}
          onResetAfterApproval={onResetAfterApproval}
          useHtmlEmail={useHtmlEmail}
          inspectionId={inspectionId}
        />
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
            Back
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear inspection data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all inspection fields. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Saving…" : isBraceletOnly ? "Save Inspection" : "Save & Add to Queue"}
        </Button>
      </div>
    </div>
  );
}

// Legacy exports for compatibility
export type ConditionValue = {
  condition: string;
  notes?: string;
  price?: number;
};

export type InspectionFormData = {
  inspectionType: string;
  crystalCondition: ConditionValue;
  dialCondition: ConditionValue;
  handsCondition: ConditionValue;
  crownCondition: ConditionValue;
  bezelCondition: ConditionValue;
  caseCondition: ConditionValue;
  braceletCondition: ConditionValue;
  notes: string;
  waiverRequired: boolean;
  waiverSigned: boolean;
};

// Helper to create empty expanded form data
export const emptyExpandedInspectionData = (): ExpandedInspectionFormData => ({
  inspectionType: "complete_watch",
  jobType: "",
  jobTypes: [],
  dialCondition: emptySectionCondition(),
  handsCondition: emptySectionCondition(),
  bezelCondition: emptySectionCondition(),
  crownCondition: emptySectionCondition(),
  caseCondition: emptySectionCondition(),
  crystalCondition: emptySectionCondition(),
  braceletCondition: emptySectionCondition(),
  weldingPrice: undefined,
  caseRestorePrice: undefined,
  caseRestoreAddYesNo: false,
  watchHeadRestorePrice: undefined,
  watchHeadRestoreAddYesNo: false,
  gasketsPrice: undefined,
  gasketsAddYesNo: false,
  crystalPolishPrice: undefined,
  crystalPolishApproved: undefined,
  braceletRepair: emptyBraceletRepairData(),
  braceletItems: undefined,
  miscNotes: "",
  miscNotesPrice: undefined,
  miscNotesAddYesNo: false,
  waiverRequired: false,
  waiverSigned: false,
  weeksToTarget: 4,
  customTargetDate: undefined,
  departmentTags: [],
  totalItems: undefined,
  currentItemNumber: undefined,
  totalEstimate: 0,
});
