import * as React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useVerifyPin } from "@/hooks/use-security";
import { useAuth } from "@/components/auth/AuthProvider";

interface PinLockScreenProps {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = React.useState("");
  const [attempts, setAttempts] = React.useState(0);
  const { signOut } = useAuth();
  const verifyPin = useVerifyPin();

  const MAX_ATTEMPTS = 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (attempts >= MAX_ATTEMPTS) {
      toast.error("Too many failed attempts. Please sign in again.");
      await signOut();
      return;
    }

    try {
      const result = await verifyPin.mutateAsync(pin);

      if (result.valid) {
        toast.success("Session unlocked");
        setPin("");
        setAttempts(0);
        onUnlock();
      } else {
        setAttempts((prev) => prev + 1);
        setPin("");
        toast.error(`Invalid PIN. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
      }
    } catch (error) {
      toast.error("Failed to verify PIN");
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <main className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Session Locked</CardTitle>
          <CardDescription>
            Enter your PIN to continue or sign out to switch accounts
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                disabled={pin.length < 4 || verifyPin.isPending}
              >
                {verifyPin.isPending ? "Verifying…" : "Unlock"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>

            {attempts > 0 && (
              <p className="text-center text-sm text-destructive">
                {MAX_ATTEMPTS - attempts} attempts remaining
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
