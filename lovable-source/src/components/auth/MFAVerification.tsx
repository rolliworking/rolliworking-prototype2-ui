import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2 } from 'lucide-react';

interface MFAVerificationProps {
  factorId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerification({ factorId, onSuccess, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the challenge with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        throw verifyError;
      }

      toast({
        title: 'Verified',
        description: 'Two-factor authentication successful',
      });

      onSuccess();
    } catch (error) {
      console.error('MFA verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Invalid code. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-accent/10">
            <Shield className="h-8 w-8 text-accent" />
          </div>
        </div>
        <CardTitle className="text-2xl font-serif">Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isVerifying || code.length !== 6}>
            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
