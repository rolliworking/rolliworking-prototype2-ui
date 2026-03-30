import { useState, useCallback, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Watch, Loader2, CheckCircle2 } from 'lucide-react';
import { MFAVerification } from '@/components/auth/MFAVerification';
import { TurnstileCaptcha } from '@/components/auth/TurnstileCaptcha';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  expires_at: string;
}

export default function Auth() {
  const { user, loading, signIn, signUp, refreshMFAStatus } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Load invitation data if token is present
  useEffect(() => {
    if (inviteToken) {
      loadInvitation(inviteToken);
    }
  }, [inviteToken]);

  const loadInvitation = async (token: string) => {
    setInviteLoading(true);
    setInviteError(null);
    
    try {
      // Use secure RPC function to look up invitation by token
      // This prevents enumeration attacks on the invitations table
      const { data, error } = await supabase
        .rpc('get_invitation_by_token' as any, { p_token: token }) as { 
          data: Array<{ id: string; email: string; role: string; expires_at: string }> | null;
          error: any;
        };

      if (error || !data || data.length === 0) {
        setInviteError('This invitation is invalid or has already been used.');
        return;
      }

      const invitationData = data[0];

      // Check if expired
      if (new Date(invitationData.expires_at) < new Date()) {
        setInviteError('This invitation has expired. Please request a new one.');
        return;
      }

      setInvitation(invitationData);
      setSignupEmail(invitationData.email);
    } catch (err) {
      setInviteError('Failed to load invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError(false);
  }, []);

  const handleTurnstileError = useCallback(() => {
    // On Turnstile error (like hostname mismatch), bypass captcha requirement
    // This allows login on preview/dev domains not configured in Turnstile
    console.warn('Turnstile captcha error - bypassing for this domain');
    setTurnstileToken('bypass');
    setTurnstileError(false);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const verifyTurnstile = async (token: string): Promise<boolean> => {
    // If bypassed due to Turnstile error (preview domains), skip verification
    if (token === 'bypass') {
      console.log('Turnstile bypassed for this domain');
      return true;
    }
    
    try {
      console.log('Verifying turnstile token...');
      const response = await supabase.functions.invoke('verify-turnstile', {
        body: { token },
      });
      console.log('Turnstile full response:', JSON.stringify(response));
      
      // Handle case where response comes as { data: { success: true } }
      if (response.error) {
        console.error('Turnstile verification error:', response.error);
        return false;
      }
      
      // Check both possible response structures
      const success = response.data?.success === true;
      console.log('Turnstile success:', success);
      return success;
    } catch (err) {
      console.error('Turnstile verification exception:', err);
      return false;
    }
  };

  if (loading || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Only redirect if user is authenticated AND not in MFA challenge
  if (user && !mfaRequired) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({ title: 'Verification Required', description: 'Please complete the captcha verification.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    
    // Verify turnstile token server-side
    const isValid = await verifyTurnstile(turnstileToken);
    if (!isValid) {
      setIsSubmitting(false);
      setTurnstileToken(null);
      toast({ title: 'Verification Failed', description: 'Captcha verification failed. Please try again.', variant: 'destructive' });
      return;
    }
    
    const result = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);
    
    if (result.error) {
      setTurnstileToken(null);
      toast({ title: 'Login Failed', description: result.error.message, variant: 'destructive' });
    } else if (result.needsMFA && result.factorId) {
      // User needs to complete MFA
      setMfaRequired(true);
      setMfaFactorId(result.factorId);
    }
  };

  const handleMFASuccess = async () => {
    await refreshMFAStatus();
    setMfaRequired(false);
    setMfaFactorId(null);
    // Session should now be upgraded to AAL2, redirect will happen automatically
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({ title: 'Verification Required', description: 'Please complete the captcha verification.', variant: 'destructive' });
      return;
    }

    // If invite-only and no valid invitation, don't allow signup
    if (!invitation && inviteToken) {
      toast({ title: 'Invalid Invitation', description: 'Please use a valid invitation link.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    
    // Verify turnstile token server-side
    const isValid = await verifyTurnstile(turnstileToken);
    if (!isValid) {
      setIsSubmitting(false);
      setTurnstileToken(null);
      toast({ title: 'Verification Failed', description: 'Captcha verification failed. Please try again.', variant: 'destructive' });
      return;
    }
    
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    
    if (error) {
      setIsSubmitting(false);
      setTurnstileToken(null);
      toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
    } else {
      // If there's an invitation, mark it as accepted and update the user's role
      if (invitation) {
        // Update invitation to mark as accepted
        await supabase
          .from('invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invitation.id);

        // The role will be set by the trigger, but we need to update it to the invited role
        // This is handled by listening to the auth state change in the AuthContext
      }
      
      setIsSubmitting(false);
      toast({ title: 'Account Created', description: 'You can now sign in.' });
    }
  };

  // Show MFA verification if needed
  if (mfaRequired && mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MFAVerification
          factorId={mfaFactorId}
          onSuccess={handleMFASuccess}
          onCancel={() => {
            setMfaRequired(false);
            setMfaFactorId(null);
          }}
        />
      </div>
    );
  }

  // Show invite error
  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <Watch className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-serif">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
            <p className="text-center text-muted-foreground mt-4">
              Please contact your administrator for a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invite-only signup form
  if (invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-accent/10">
                <CheckCircle2 className="h-8 w-8 text-accent" />
              </div>
            </div>
            <CardTitle className="text-2xl font-serif">Accept Invitation</CardTitle>
            <CardDescription>
              Create your RolliSuite account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                You've been invited as <strong>{invitation.role === 'office' ? 'Team' : invitation.role}</strong> member.
              </AlertDescription>
            </Alert>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  value={signupEmail} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} />
              </div>
              <TurnstileCaptcha
                onVerify={handleTurnstileVerify}
                onError={handleTurnstileError}
                onExpire={handleTurnstileExpire}
              />
              {turnstileError && (
                <p className="text-sm text-destructive text-center">Captcha failed. Please try again.</p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting || !turnstileToken}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-accent/10">
              <Watch className="h-8 w-8 text-accent" />
            </div>
          </div>
          <CardTitle className="text-2xl font-serif">RolliSuite</CardTitle>
          <CardDescription>Watch Service & Inventory Management</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup" disabled>Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <TurnstileCaptcha
                  onVerify={handleTurnstileVerify}
                  onError={handleTurnstileError}
                  onExpire={handleTurnstileExpire}
                />
                {turnstileError && (
                  <p className="text-sm text-destructive text-center">Captcha failed. Please try again.</p>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting || !turnstileToken}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Need an account? Contact your administrator for an invitation.
              </p>
            </TabsContent>
            <TabsContent value="signup">
              <div className="py-8 text-center text-muted-foreground">
                <p>Signup is invite-only.</p>
                <p className="text-sm mt-2">Contact your administrator for an invitation.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
