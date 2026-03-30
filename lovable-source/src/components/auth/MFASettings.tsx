import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { MFAEnrollment } from './MFAEnrollment';

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export function MFASettings() {
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showUnenrollDialog, setShowUnenrollDialog] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<MFAFactor | null>(null);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        throw error;
      }

      // Filter to only verified TOTP factors
      const verifiedFactors = data.totp.filter(f => f.status === 'verified');
      setFactors(verifiedFactors as MFAFactor[]);
    } catch (error) {
      console.error('Error fetching MFA factors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!selectedFactor) return;

    setIsUnenrolling(true);

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: selectedFactor.id,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'MFA Disabled',
        description: 'Two-factor authentication has been removed from your account',
      });

      setShowUnenrollDialog(false);
      setSelectedFactor(null);
      fetchFactors();
    } catch (error) {
      console.error('Error unenrolling MFA:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disable MFA',
        variant: 'destructive',
      });
    } finally {
      setIsUnenrolling(false);
    }
  };

  const hasMFAEnabled = factors.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (showEnrollment) {
    return (
      <div className="flex justify-center">
        <MFAEnrollment
          onComplete={() => {
            setShowEnrollment(false);
            fetchFactors();
          }}
          onCancel={() => setShowEnrollment(false)}
        />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {hasMFAEnabled ? (
              <ShieldCheck className="h-6 w-6 text-green-600" />
            ) : (
              <Shield className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
              <CardDescription>
                {hasMFAEnabled
                  ? 'Your account is protected with MFA'
                  : 'Add an extra layer of security to your account'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasMFAEnabled ? (
            <div className="space-y-4">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">{factor.friendly_name || 'Authenticator App'}</p>
                      <p className="text-sm text-muted-foreground">
                        Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedFactor(factor);
                      setShowUnenrollDialog(true);
                    }}
                  >
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Button onClick={() => setShowEnrollment(true)}>
              <Shield className="h-4 w-4 mr-2" />
              Enable MFA
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUnenrollDialog} onOpenChange={setShowUnenrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              This will remove MFA from your account. You can enable it again at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnenrollDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnenroll}
              disabled={isUnenrolling}
            >
              {isUnenrolling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Disable MFA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
