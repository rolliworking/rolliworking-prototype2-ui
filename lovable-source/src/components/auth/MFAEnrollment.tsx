import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, CheckCircle, Copy } from 'lucide-react';

interface MFAEnrollmentProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function MFAEnrollment({ onComplete, onCancel }: MFAEnrollmentProps) {
  const [step, setStep] = useState<'loading' | 'qr' | 'verify' | 'success'>('loading');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) {
        throw error;
      }

      if (data.type === 'totp') {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('qr');
      }
    } catch (error) {
      console.error('MFA enrollment error:', error);
      toast({
        title: 'Enrollment Failed',
        description: error instanceof Error ? error.message : 'Failed to start MFA enrollment',
        variant: 'destructive',
      });
      onCancel();
    }
  };

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
      // Create a challenge to verify enrollment
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        throw verifyError;
      }

      setStep('success');
      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been enabled for your account',
      });

      setTimeout(() => {
        onComplete();
      }, 2000);
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

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast({
      title: 'Copied',
      description: 'Secret key copied to clipboard',
    });
  };

  if (step === 'loading') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  if (step === 'success') {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="p-3 rounded-full bg-green-100">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold">MFA Enabled!</h3>
          <p className="text-muted-foreground text-center">
            Your account is now protected with two-factor authentication.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-accent/10">
            <Shield className="h-8 w-8 text-accent" />
          </div>
        </div>
        <CardTitle className="text-xl font-serif">Set Up Two-Factor Authentication</CardTitle>
        <CardDescription>
          {step === 'qr' 
            ? 'Scan the QR code with your authenticator app'
            : 'Enter the code from your authenticator app'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'qr' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg shadow-inner">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Can't scan? Enter this key manually:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copySecret}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setStep('verify')}>
              I've scanned the code
            </Button>
            <Button variant="ghost" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
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
              Verify & Enable
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('qr')}>
              Back to QR Code
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
