import { AlertTriangle, CheckCircle2, User, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";

interface BarcodeConfirmData {
  estimateNumber: string;
  name: string;
  email: string;
  phone: string;
  referenceNumber: string;
  rawBarcode: string;
  matchedCustomerName?: string;
}

interface BarcodeConfirmDialogProps {
  open: boolean;
  data: BarcodeConfirmData | null;
  onConfirm: (correctedRawBarcode: string) => void;
  onSkip: () => void;
}

export type { BarcodeConfirmData };

export function BarcodeConfirmDialog({ open, data, onConfirm, onSkip }: BarcodeConfirmDialogProps) {
  const [editedEstimate, setEditedEstimate] = useState("");

  // Sync when data changes
  const estimateNumber = editedEstimate || data?.estimateNumber || "";

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && data) {
      setEditedEstimate(data.estimateNumber);
    }
    if (!isOpen) {
      onSkip();
    }
  };

  if (!data) return null;

  const isEdited = editedEstimate && editedEstimate !== data.estimateNumber;

  const handleConfirm = () => {
    if (isEdited) {
      // Rebuild rawBarcode with corrected estimate
      const corrected = data.rawBarcode.replace(
        `#:${data.estimateNumber}`,
        `#:${editedEstimate}`
      );
      onConfirm(corrected);
    } else {
      onConfirm(data.rawBarcode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Verify Scanned Label Data
          </DialogTitle>
          <DialogDescription>
            The AI read the following from the barcode label. Please verify the estimate number is correct before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Estimate Number - editable and prominent */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-estimate" className="text-sm font-semibold flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              Estimate Number
            </Label>
            <Input
              id="confirm-estimate"
              value={estimateNumber}
              onChange={(e) => setEditedEstimate(e.target.value)}
              className="text-lg font-mono font-bold h-12"
              autoFocus
            />
            {isEdited && (
              <p className="text-xs text-amber-600 font-medium">
                ✏️ Changed from "{data.estimateNumber}" → "{editedEstimate}"
              </p>
            )}
          </div>

          {/* Customer info - read only display */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Customer from label
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Name:</span>
                <p className="font-medium">{data.name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Reference:</span>
                <p className="font-medium font-mono">{data.referenceNumber || "—"}</p>
              </div>
              {data.email && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">Email:</span>
                  <p className="font-medium text-xs">{data.email}</p>
                </div>
              )}
            </div>

            {data.matchedCustomerName && data.matchedCustomerName !== data.name && (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  ⚠️ Database match: "{data.matchedCustomerName}" — different from label name "{data.name}"
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onSkip}>
            Skip — enter manually
          </Button>
          <Button onClick={handleConfirm} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {isEdited ? "Use Corrected Est#" : "Confirm & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
