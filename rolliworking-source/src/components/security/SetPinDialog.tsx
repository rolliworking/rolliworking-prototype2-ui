import * as React from "react";
import { toast } from "sonner";
import { Key, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSetUserPin, useClearUserPin } from "@/hooks/use-security";

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  hasExistingPin: boolean;
}

export function SetPinDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  hasExistingPin,
}: SetPinDialogProps) {
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");

  const setUserPin = useSetUserPin();
  const clearUserPin = useClearUserPin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 4 || pin.length > 6) {
      toast.error("PIN must be 4-6 digits");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    try {
      await setUserPin.mutateAsync({ targetUserId, pin });
      toast.success(`PIN set for ${targetUserName}`);
      setPin("");
      setConfirmPin("");
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to set PIN");
    }
  };

  const handleClearPin = async () => {
    try {
      await clearUserPin.mutateAsync(targetUserId);
      toast.success(`PIN cleared for ${targetUserName}`);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to clear PIN");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {hasExistingPin ? "Update" : "Set"} PIN for {targetUserName}
          </DialogTitle>
          <DialogDescription>
            This PIN will be used to unlock the session after timeout. Only 4-6 digit numeric PINs are allowed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 4-6 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.5em] font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.5em] font-mono"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {hasExistingPin && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearPin}
                disabled={clearUserPin.isPending}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear PIN
              </Button>
            )}
            <Button
              type="submit"
              disabled={pin.length < 4 || pin !== confirmPin || setUserPin.isPending}
            >
              {setUserPin.isPending ? "Saving…" : hasExistingPin ? "Update PIN" : "Set PIN"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
