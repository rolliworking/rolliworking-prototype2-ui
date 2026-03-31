import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

const HOURLY_RATE = 98;

export interface BraceletRepairData {
  // Steel side work
  steelSideHours: string;
  steelSideShowYesNo: boolean;
  steelSideRecommendation: "recommended" | "not_recommended" | "";
  
  // Steel center work
  steelCenterHours: string;
  steelCenterShowYesNo: boolean;
  steelCenterRecommendation: "recommended" | "not_recommended" | "";
  
  // Gold center work
  goldCenterPieces: number;
  goldCenterPricePerPiece: number;
  goldCenterShowYesNo: boolean;
  goldCenterRecommendation: "recommended" | "not_recommended" | "";
  
  // Shorter links
  shorterLinksQty: number;
  shorterLinksPrice: number;
  shorterLinksShowYesNo: boolean;
  
  // Invert pieces
  invertPiecesQty: number;
  invertPricePerPiece: number;
  invertPiecesShowYesNo: boolean;
  
  // Band polish question for email
  includeBandPolishQuestion: boolean;
}

interface BraceletRepairOptionsProps {
  value: BraceletRepairData;
  onChange: (value: BraceletRepairData) => void;
  className?: string;
}

export function BraceletRepairOptions({ value, onChange, className }: BraceletRepairOptionsProps) {
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Wrench className="h-3.5 w-3.5" />
          Bracelet Repair Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3 pt-0">
        {/* Might Need Extra Links (formerly Shorter Links) - FIRST */}
        <div className="rounded-md border p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs font-medium">Might need extra links</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min={0}
                value={value.shorterLinksQty || ""}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value) || 0;
                  const hasValue = newQty > 0 && value.shorterLinksPrice > 0;
                  onChange({ 
                    ...value, 
                    shorterLinksQty: newQty,
                    shorterLinksShowYesNo: hasValue ? true : value.shorterLinksShowYesNo
                  });
                }}
                placeholder="Qty"
                className="w-14 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">×$</span>
              <Input
                type="number"
                min={0}
                value={value.shorterLinksPrice || ""}
                onChange={(e) => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  const hasValue = value.shorterLinksQty > 0 && newPrice > 0;
                  onChange({ 
                    ...value, 
                    shorterLinksPrice: newPrice,
                    shorterLinksShowYesNo: hasValue ? true : value.shorterLinksShowYesNo
                  });
                }}
                placeholder="Price"
                className="w-16 h-7 text-xs"
              />
            </div>
          </div>
          {value.shorterLinksQty > 0 && value.shorterLinksPrice > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t">
              <p className="text-xs">{value.shorterLinksQty} links @ ${value.shorterLinksPrice}</p>
              <Button
                type="button"
                variant={value.shorterLinksShowYesNo ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => onChange({ ...value, shorterLinksShowYesNo: !value.shorterLinksShowYesNo })}
              >
                Yes/No
              </Button>
            </div>
          )}
        </div>

        {/* Steel Side Work */}
        <div className="rounded-md border p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <p className="text-xs font-medium">Steel Side pieces - inner corners</p>
              <p className="text-[10px] text-muted-foreground">@${HOURLY_RATE}/hr</p>
              <p className="text-[10px] font-bold text-destructive mt-0.5">POLISHING WILL BE REQUIRED IF WELDING IS DONE</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={value.steelSideHours}
                onChange={(e) => {
                  const newHours = e.target.value;
                  const hasValue = newHours && parseFloat(newHours) > 0;
                  onChange({ 
                    ...value, 
                    steelSideHours: newHours,
                    steelSideShowYesNo: hasValue ? true : value.steelSideShowYesNo
                  });
                }}
                placeholder="Hrs"
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>
          </div>
          {value.steelSideHours && (
            <div className="flex items-center justify-between pt-1.5 border-t flex-wrap gap-2">
              <p className="text-xs">{value.steelSideHours} hrs @ ${HOURLY_RATE}/hr</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={value.steelSideRecommendation}
                  onValueChange={(v) => onChange({ ...value, steelSideRecommendation: v as typeof value.steelSideRecommendation })}
                >
                  <SelectTrigger className="h-6 w-28 text-xs">
                    <SelectValue placeholder="Rec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="not_recommended">Not Rec</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={value.steelSideShowYesNo ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onChange({ ...value, steelSideShowYesNo: !value.steelSideShowYesNo })}
                >
                  Yes/No
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Steel Center Work */}
        <div className="rounded-md border p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <p className="text-xs font-medium">Steel Center pieces - inner corners</p>
              <p className="text-[10px] text-muted-foreground">@${HOURLY_RATE}/hr</p>
              <p className="text-[10px] font-bold text-destructive mt-0.5">POLISHING WILL BE REQUIRED IF WELDING IS DONE</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={value.steelCenterHours}
                onChange={(e) => {
                  const newHours = e.target.value;
                  const hasValue = newHours && parseFloat(newHours) > 0;
                  onChange({ 
                    ...value, 
                    steelCenterHours: newHours,
                    steelCenterShowYesNo: hasValue ? true : value.steelCenterShowYesNo
                  });
                }}
                placeholder="Hrs"
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>
          </div>
          {value.steelCenterHours && (
            <div className="flex items-center justify-between pt-1.5 border-t flex-wrap gap-2">
              <p className="text-xs">{value.steelCenterHours} hrs @ ${HOURLY_RATE}/hr</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={value.steelCenterRecommendation}
                  onValueChange={(v) => onChange({ ...value, steelCenterRecommendation: v as typeof value.steelCenterRecommendation })}
                >
                  <SelectTrigger className="h-6 w-28 text-xs">
                    <SelectValue placeholder="Rec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="not_recommended">Not Rec</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={value.steelCenterShowYesNo ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onChange({ ...value, steelCenterShowYesNo: !value.steelCenterShowYesNo })}
                >
                  Yes/No
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Gold Center Work */}
        <div className="rounded-md border p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs font-medium">Gold Center pieces - inner corners</p>
              <p className="text-[10px] font-bold text-destructive mt-0.5">POLISHING WILL BE REQUIRED IF WELDING IS DONE</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min={0}
                value={value.goldCenterPieces || ""}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value) || 0;
                  const hasValue = newQty > 0 && value.goldCenterPricePerPiece > 0;
                  onChange({ 
                    ...value, 
                    goldCenterPieces: newQty,
                    goldCenterShowYesNo: hasValue ? true : value.goldCenterShowYesNo
                  });
                }}
                placeholder="Qty"
                className="w-14 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">×$</span>
              <Input
                type="number"
                min={0}
                value={value.goldCenterPricePerPiece || ""}
                onChange={(e) => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  const hasValue = value.goldCenterPieces > 0 && newPrice > 0;
                  onChange({ 
                    ...value, 
                    goldCenterPricePerPiece: newPrice,
                    goldCenterShowYesNo: hasValue ? true : value.goldCenterShowYesNo
                  });
                }}
                placeholder="Price"
                className="w-16 h-7 text-xs"
              />
            </div>
          </div>
          {value.goldCenterPieces > 0 && value.goldCenterPricePerPiece > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t flex-wrap gap-2">
              <p className="text-xs">{value.goldCenterPieces} pcs × ${value.goldCenterPricePerPiece}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={value.goldCenterRecommendation}
                  onValueChange={(v) => onChange({ ...value, goldCenterRecommendation: v as typeof value.goldCenterRecommendation })}
                >
                  <SelectTrigger className="h-6 w-28 text-xs">
                    <SelectValue placeholder="Rec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="not_recommended">Not Rec</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={value.goldCenterShowYesNo ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onChange({ ...value, goldCenterShowYesNo: !value.goldCenterShowYesNo })}
                >
                  Yes/No
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Invert Pieces - with larger gap above */}
        <div className="rounded-md border p-2.5 space-y-2 mt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <p className="text-xs font-medium">Center pieces foil thin</p>
              <p className="text-[10px] text-muted-foreground">Invert pieces if none break</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min={0}
                value={value.invertPiecesQty || ""}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value) || 0;
                  const hasValue = newQty > 0 && value.invertPricePerPiece > 0;
                  onChange({ 
                    ...value, 
                    invertPiecesQty: newQty,
                    invertPiecesShowYesNo: hasValue ? true : value.invertPiecesShowYesNo
                  });
                }}
                placeholder="Qty"
                className="w-14 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">×$</span>
              <Input
                type="number"
                min={0}
                value={value.invertPricePerPiece || ""}
                onChange={(e) => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  const hasValue = value.invertPiecesQty > 0 && newPrice > 0;
                  onChange({ 
                    ...value, 
                    invertPricePerPiece: newPrice,
                    invertPiecesShowYesNo: hasValue ? true : value.invertPiecesShowYesNo
                  });
                }}
                placeholder="Price"
                className="w-16 h-7 text-xs"
              />
            </div>
          </div>
          {value.invertPiecesQty > 0 && value.invertPricePerPiece > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t">
              <p className="text-xs">{value.invertPiecesQty} pcs × ${value.invertPricePerPiece}</p>
              <Button
                type="button"
                variant={value.invertPiecesShowYesNo ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => onChange({ ...value, invertPiecesShowYesNo: !value.invertPiecesShowYesNo })}
              >
                Yes/No
              </Button>
            </div>
          )}
        </div>

        {/* Band Polish Question Toggle */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-primary">Band Polish Question</p>
              <p className="text-[10px] text-muted-foreground">0-10 scale in email</p>
            </div>
            <Button
              type="button"
              variant={value.includeBandPolishQuestion ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => onChange({ ...value, includeBandPolishQuestion: !value.includeBandPolishQuestion })}
            >
              {value.includeBandPolishQuestion ? "Included" : "Not Included"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const emptyBraceletRepairData = (): BraceletRepairData => ({
  steelSideHours: "",
  steelSideShowYesNo: false,
  steelSideRecommendation: "",
  steelCenterHours: "",
  steelCenterShowYesNo: false,
  steelCenterRecommendation: "",
  goldCenterPieces: 0,
  goldCenterPricePerPiece: 0,
  goldCenterShowYesNo: false,
  goldCenterRecommendation: "",
  shorterLinksQty: 0,
  shorterLinksPrice: 0,
  shorterLinksShowYesNo: false,
  invertPiecesQty: 0,
  invertPricePerPiece: 0,
  invertPiecesShowYesNo: false,
  includeBandPolishQuestion: false, // Default to NOT included (will be set based on inspection type)
});
