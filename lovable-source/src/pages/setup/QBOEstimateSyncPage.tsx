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
import { format, subMonths } from 'date-fns';
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Info,
  FlaskConical,
  Building2,
  RotateCcw,
  Users,
  Calendar,
  Shield,
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
    customersCreated: number;
  };
  newRefreshToken?: string;
  errorType?: string;
  requiresReconnect?: boolean;
}

const QBOEstimateSyncPage = () => {
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();
  const [refreshToken, setRefreshToken] = useState('');
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [newToken, setNewToken] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [useStoredToken, setUseStoredToken] = useState(true);

  // Permission check
  if (permissionsLoading) {
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
  
  // Date range - default to last 6 months
  const today = new Date();
  const sixMonthsAgo = subMonths(today, 6);
  const [startDate, setStartDate] = useState(format(sixMonthsAgo, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'));

  // Fetch stored token from database
  const { data: storedToken, isLoading: tokenLoading } = useQuery({
    queryKey: ['qbo-token', useSandbox ? 'sandbox' : 'production'],
    queryFn: async () => {
      const environment = useSandbox ? 'sandbox' : 'production';
      const { data, error } = await supabase
        .from('qbo_tokens')
        .select('refresh_token, last_sync_at, access_token_expires_at')
        .eq('environment', environment)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // When stored token is found, default to using it
  useEffect(() => {
    if (storedToken?.refresh_token) {
      setUseStoredToken(true);
    }
  }, [storedToken]);

  const syncMutation = useMutation({
    mutationFn: async ({ token, sandbox, start, end }: { token: string; sandbox: boolean; start: string; end: string }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('qbo-estimate-sync', {
        body: { refresh_token: token, use_sandbox: sandbox, start_date: start, end_date: end },
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
        toast.success(`Synced ${result.result?.created || 0} new, ${result.result?.updated || 0} updated estimates`);
        setRefreshToken('');
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

  const handleSync = () => {
    // Use stored token if available and selected, otherwise use manual input
    const tokenToUse = useStoredToken && storedToken?.refresh_token 
      ? storedToken.refresh_token 
      : refreshToken.replace(/\s+/g, '');

    if (!tokenToUse) {
      toast.error('No token available. Please enter a refresh token or reconnect to QuickBooks.');
      return;
    }

    if (!/^RT\d?-/i.test(tokenToUse) && tokenToUse.startsWith('eyJ')) {
      toast.error('That looks like an access token. Please paste the Refresh Token (starts with RT1-...)');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select a date range');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date must be before end date');
      return;
    }

    syncMutation.mutate({ token: tokenToUse, sandbox: useSandbox, start: startDate, end: endDate });
  };

  const copyNewToken = () => {
    navigator.clipboard.writeText(newToken);
    toast.success('New refresh token copied to clipboard');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">QBO Estimate Import</h1>
        <p className="text-muted-foreground mt-1">
          Import estimates from QuickBooks Online
        </p>
      </div>

      {/* Instructions Card - only show if no stored token */}
      {!storedToken?.refresh_token && (
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
              <li>Sign in and select your app with <strong>Accounting</strong> scope</li>
              <li>Connect to your QuickBooks company</li>
              <li>Copy the <strong>Refresh Token</strong> from the response</li>
            </ol>
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                Missing customers will be auto-created from QBO data during import.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Stored Token Status */}
      {storedToken?.refresh_token && (
        <Card className="border-green-500/50 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">QuickBooks Connected</p>
                  <p className="text-sm text-muted-foreground">
                    Last synced: {storedToken.last_sync_at 
                      ? format(new Date(storedToken.last_sync_at), 'MMM d, yyyy h:mm a')
                      : 'Never'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setUseStoredToken(!useStoredToken)}
              >
                {useStoredToken ? 'Enter New Token' : 'Use Stored Token'}
              </Button>
            </div>
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
                    ? 'Using test data from your QBO sandbox' 
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

      {/* Sync Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Estimates
          </CardTitle>
          <CardDescription>
            Import estimates from QBO for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Only show token input if no stored token or user wants to enter new one */}
          {(!storedToken?.refresh_token || !useStoredToken) && (
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
            disabled={syncMutation.isPending || tokenLoading || (!useStoredToken && !refreshToken.trim() && !storedToken?.refresh_token)}
            className="w-full"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing estimates...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Import Estimates
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
              className="inline-flex items-center gap-1 underline"
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
              Import Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={lastResult.success ? 'default' : 'destructive'}>
              <AlertTitle>
                {lastResult.success ? 'Success' : 'Error'}
              </AlertTitle>
              <AlertDescription>
                {lastResult.message || (lastResult.success ? 'Import completed' : 'Import failed')}
                {lastResult.result && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span>Created: <strong>{lastResult.result.created}</strong></span>
                    <span>Updated: <strong>{lastResult.result.updated}</strong></span>
                    <span>Total: <strong>{lastResult.result.total}</strong></span>
                    <span>Customers Created: <strong>{lastResult.result.customersCreated}</strong></span>
                    <span>Skipped: <strong>{lastResult.result.skipped}</strong></span>
                    <span>Errors: <strong>{lastResult.result.errors.length}</strong></span>
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {lastResult.result?.errors && lastResult.result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Import Errors ({lastResult.result.errors.length})</AlertTitle>
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

            {newToken && (
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QBOEstimateSyncPage;
