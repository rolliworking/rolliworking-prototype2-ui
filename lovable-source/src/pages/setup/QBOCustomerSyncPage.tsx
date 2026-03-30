import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import {
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Info,
  FlaskConical,
  Building2,
  ShieldAlert,
  RotateCcw,
  Shield,
  Database,
  Clock,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface SyncResult {
  success: boolean;
  message?: string;
  result?: {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    total: number;
  };
  newRefreshToken?: string;
  errorType?: string;
  requiresReconnect?: boolean;
  usedDiscoveryDoc?: boolean;
}

const QBOCustomerSyncPage = () => {
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const [refreshToken, setRefreshToken] = useState('');
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [newToken, setNewToken] = useState('');
  const [useSandbox, setUseSandbox] = useState(false); // Default to production
  const [useStoredToken, setUseStoredToken] = useState(false);

  // Fetch stored token for current environment
  const { data: storedToken, isLoading: tokenLoading } = useQuery({
    queryKey: ['qbo-token', useSandbox ? 'sandbox' : 'production'],
    queryFn: async () => {
      const environment = useSandbox ? 'sandbox' : 'production';
      const { data, error } = await supabase
        .from('qbo_tokens')
        .select('refresh_token, last_sync_at, access_token_expires_at, updated_at')
        .eq('environment', environment)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // When stored token is found, default to using it
  useEffect(() => {
    if (storedToken?.refresh_token) {
      setUseStoredToken(true);
    } else {
      setUseStoredToken(false);
    }
  }, [storedToken]);

  const syncMutation = useMutation({
    mutationFn: async ({ token, sandbox }: { token: string; sandbox: boolean }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('qbo-customer-sync', {
        body: { refresh_token: token, use_sandbox: sandbox },
      });

      if (error) {
        throw new Error(error.message || 'Sync failed');
      }

      return data;
    },
    onSuccess: (result) => {
      setLastResult(result);
      if (result.newRefreshToken) {
        setNewToken(result.newRefreshToken);
      }
      if (result.success) {
        toast.success(`Synced ${result.result?.created || 0} new, ${result.result?.updated || 0} updated customers`);
        setRefreshToken(''); // Clear the input after success
      } else if (result.requiresReconnect) {
        toast.error('QuickBooks connection expired - please reconnect');
      } else {
        toast.error(result.message || 'Sync failed');
      }
    },
    onError: (error: Error) => {
      setLastResult({
        success: false,
        message: error.message,
      });
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Permission check - AFTER all hooks
  if (permissionsLoading || tokenLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessSetup) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSync = () => {
    let token: string;
    
    if (useStoredToken && storedToken?.refresh_token) {
      token = storedToken.refresh_token;
    } else {
      token = refreshToken.replace(/\s+/g, '');
      
      if (!token) {
        toast.error('Please enter a refresh token');
        return;
      }

      // Intuit refresh tokens look like "RT1-...".
      // If an accessToken/idToken ("eyJ...") is pasted, Intuit returns invalid_grant.
      if (!/^RT\d?-/i.test(token) && token.startsWith('eyJ')) {
        toast.error('That looks like an access token / id token. Please paste the Refresh Token (starts with RT1-...)');
        return;
      }
    }

    syncMutation.mutate({ token, sandbox: useSandbox });
  };

  const copyNewToken = () => {
    navigator.clipboard.writeText(newToken);
    toast.success('New refresh token copied to clipboard');
  };

  // Calculate days remaining on token (QBO tokens last ~100 days)
  const getDaysRemaining = () => {
    if (!storedToken?.updated_at) return null;
    const updatedAt = new Date(storedToken.updated_at);
    const expiresAt = new Date(updatedAt.getTime() + 100 * 24 * 60 * 60 * 1000); // 100 days
    return Math.max(0, differenceInDays(expiresAt, new Date()));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">QBO Customer Sync</h1>
        <p className="text-muted-foreground mt-1">
          Import customers from QuickBooks Online using the API
        </p>
      </div>

      {/* Stored Token Status */}
      {storedToken?.refresh_token && (
        <Card className="border-green-500/50 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Stored Token Available</p>
                  <div className="flex items-center gap-4 text-sm text-green-700">
                    {storedToken.last_sync_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last sync: {formatDistanceToNow(new Date(storedToken.last_sync_at), { addSuffix: true })}
                      </span>
                    )}
                    {daysRemaining !== null && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {daysRemaining} days remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="use-stored" className="text-sm">
                  Use stored token
                </Label>
                <Switch
                  id="use-stored"
                  checked={useStoredToken}
                  onCheckedChange={setUseStoredToken}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card - Only show when not using stored token */}
      {!useStoredToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              How to Get a Refresh Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Go to the{' '}
                <a
                  href="https://developer.intuit.com/app/developer/playground"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Intuit OAuth Playground
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Sign in with your Intuit Developer account</li>
              <li>Select your app and choose the <strong>Accounting</strong> scope</li>
              <li>Connect to your QuickBooks company</li>
              <li>Copy the <strong>Refresh Token</strong> from the response</li>
              <li>Paste it below and click "Sync Customers"</li>
            </ol>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Refresh tokens rotate after each use. After syncing, save the new refresh token displayed below for your next sync.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Environment Toggle */}
      <Card className={useSandbox ? 'border-amber-500/50 bg-amber-50/50' : 'border-green-500/50 bg-green-50/50'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {useSandbox ? (
                <FlaskConical className="h-5 w-5 text-amber-600" />
              ) : (
                <Building2 className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className="font-medium">
                  {useSandbox ? 'Sandbox Environment' : 'Production Environment'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {useSandbox 
                    ? 'Using test data from your QBO sandbox company' 
                    : 'Using real data from your QBO production company'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="env-toggle" className="text-sm">
                {useSandbox ? 'Sandbox' : 'Production'}
              </Label>
              <Switch
                id="env-toggle"
                checked={!useSandbox}
                onCheckedChange={(checked) => setUseSandbox(!checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Features Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Intuit Compliance Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Retry with exponential backoff</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Expired token detection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Invalid grant handling</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Discovery document integration</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Rate limit handling</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Reconnect prompts</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sync Customers
          </CardTitle>
          <CardDescription>
            {useStoredToken && storedToken?.refresh_token
              ? `Using stored token to import customers from ${useSandbox ? 'sandbox' : 'production'}`
              : `Enter your QBO refresh token to import all customers from ${useSandbox ? 'sandbox' : 'production'}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!useStoredToken && (
            <div className="space-y-2">
              <Label htmlFor="refreshToken">Refresh Token</Label>
              <Textarea
                id="refreshToken"
                placeholder="Paste your QBO refresh token here..."
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          )}

          <Button
            onClick={handleSync}
            disabled={syncMutation.isPending || (!useStoredToken && !refreshToken.trim())}
            className="w-full"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing customers...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {useStoredToken ? 'Sync with Stored Token' : 'Sync Customers'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Reconnect Alert */}
      {lastResult && lastResult.requiresReconnect && (
        <Alert variant="destructive">
          <RotateCcw className="h-4 w-4" />
          <AlertTitle>Reconnection Required</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{lastResult.message}</p>
            <a
              href="https://developer.intuit.com/app/developer/playground"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-destructive-foreground underline hover:no-underline"
            >
              Reconnect via OAuth Playground
              <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Result */}
      {lastResult && !lastResult.requiresReconnect && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              Sync Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={lastResult.success ? 'default' : 'destructive'}>
              <AlertTitle>
                {lastResult.success ? 'Success' : 'Error'}
              </AlertTitle>
              <AlertDescription>
                {lastResult.message || (lastResult.success ? 'Sync completed successfully' : 'Sync failed')}
                {lastResult.result && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span>Created: <strong>{lastResult.result.created}</strong></span>
                    <span>Updated: <strong>{lastResult.result.updated}</strong></span>
                    <span>Total: <strong>{lastResult.result.total}</strong></span>
                    <span>Errors: <strong>{lastResult.result.errors.length}</strong></span>
                  </div>
                )}
                {lastResult.usedDiscoveryDoc && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ✓ Used Intuit Discovery Document for endpoints
                  </p>
                )}
              </AlertDescription>
            </Alert>

            {lastResult.result?.errors && lastResult.result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Sync Errors ({lastResult.result.errors.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs mt-2 max-h-32 overflow-auto">
                    {lastResult.result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {lastResult.result.errors.length > 10 && (
                      <li>...and {lastResult.result.errors.length - 10} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {newToken && !useStoredToken && (
              <div className="space-y-2">
                <Label>New Refresh Token (save this for next sync)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newToken}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copyNewToken}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  QBO refresh tokens rotate after each use. Copy and save this token securely for your next sync.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QBOCustomerSyncPage;
