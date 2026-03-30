import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, formatDistanceToNow } from 'date-fns';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Database,
  FileText,
  Users,
  AlertTriangle,
  Shield,
  Loader2,
} from 'lucide-react';

const QBOSyncStatusPage = () => {
  const { canAccessSetup, isLoading: permissionsLoading } = useRolePermissions();

  // Fetch stored token status - must be before conditional returns
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['qbo-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_tokens')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // Fetch recent sync logs - must be before conditional returns
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['qbo-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !permissionsLoading && canAccessSetup,
  });

  // Permission check - after all hooks
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'started':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSyncTypeIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <Users className="h-4 w-4" />;
      case 'estimate':
        return <FileText className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const productionToken = tokenData?.find(t => t.environment === 'production');
  const sandboxToken = tokenData?.find(t => t.environment === 'sandbox');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">QBO Sync Status</h1>
        <p className="text-muted-foreground mt-1">
          Monitor daily automatic sync and view recent sync history
        </p>
      </div>

      {/* Token Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={productionToken ? 'border-green-200' : 'border-amber-200'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productionToken ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last sync:</span>
                  <span>
                    {productionToken.last_sync_at 
                      ? formatDistanceToNow(new Date(productionToken.last_sync_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last type:</span>
                  <span className="capitalize">{productionToken.last_sync_type || '-'}</span>
                </div>
                {productionToken.last_sync_error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-xs">{productionToken.last_sync_error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>No token stored. Run a manual sync first to enable daily auto-sync.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={sandboxToken ? 'border-amber-200' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Sandbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sandboxToken ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="bg-amber-100 text-amber-800">Connected</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last sync:</span>
                  <span>
                    {sandboxToken.last_sync_at 
                      ? formatDistanceToNow(new Date(sandboxToken.last_sync_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>No sandbox token stored.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cron Schedule Info */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Daily Sync Schedule</AlertTitle>
        <AlertDescription>
          Automatic sync runs daily at <strong>6:00 AM UTC</strong>. It syncs customers and estimates from the last 7 days.
        </AlertDescription>
      </Alert>

      {/* Recent Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Sync History
          </CardTitle>
          <CardDescription>Last 20 sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getSyncTypeIcon(log.sync_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{log.sync_type}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.triggered_by}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.environment}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.started_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {log.status === 'success' && (
                      <div className="text-xs text-muted-foreground">
                        +{log.records_created} / ~{log.records_updated}
                      </div>
                    )}
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sync history yet</p>
              <p className="text-sm">Run a manual sync to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning if no tokens */}
      {!tokenLoading && !productionToken && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Daily Sync Not Active</AlertTitle>
          <AlertDescription>
            No production token is stored. Please run a manual sync from the{' '}
            <a href="/setup/qbo-customers" className="underline">QBO Customer Sync</a> or{' '}
            <a href="/setup/qbo-estimates" className="underline">QBO Estimate Sync</a> page to initialize daily auto-sync.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default QBOSyncStatusPage;
