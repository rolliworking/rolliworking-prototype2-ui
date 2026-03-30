import { useState, useEffect, useRef } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useJob, useUpdateJobStatus, useDeleteJob, useJobActivityLog } from '@/hooks/useJobs';
import { useTimingTests, usePressureTests } from '@/hooks/useTests';
import { useLineItems, calculateJobTotals } from '@/hooks/useLineItems';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, ArrowLeft, Watch, Copy, CheckCircle, AlertTriangle, 
  Calendar, User, FileText, Activity, Clock, Trash2, Settings,
  Gauge, Droplets, Zap, Printer
} from 'lucide-react';
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER, PRIORITY_LABELS } from '@/lib/constants';
import { JobStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading, role, permissions, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const { data: job, isLoading: jobLoading, error } = useJob(id || '');
  const { data: timingTests } = useTimingTests(id || '');
  const { data: pressureTests } = usePressureTests(id || '');
  const { data: lineItems } = useLineItems(id || '');
  const { data: activityLog } = useJobActivityLog(id || '');
  
  const updateStatus = useUpdateJobStatus();
  const deleteJob = useDeleteJob();
  
  const [copied, setCopied] = useState(false);
  const statusSelectRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        statusSelectRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading || jobLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Job Not Found</CardTitle>
            <CardDescription>The job you're looking for doesn't exist or you don't have access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard"><Button>Return to Dashboard</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestTiming = timingTests?.[0];
  const latestPressure = pressureTests?.[0];
  const isPressurePassed = latestPressure?.result_passed;
  const totals = lineItems ? calculateJobTotals(lineItems) : null;

  const copyJobLink = () => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link Copied', description: 'Job link copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (newStatus !== job.status) {
      await updateStatus.mutateAsync({
        jobId: job.id,
        oldStatus: job.status,
        newStatus,
      });
    }
  };

  const handleDelete = async () => {
    if (!permissions.canDeleteJobs) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to delete jobs.', variant: 'destructive' });
      return;
    }
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      await deleteJob.mutateAsync(job.id);
    }
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      intake: 'status-intake',
      awaiting_customer_approval: 'status-awaiting-approval',
      approved: 'status-approved',
      in_service: 'status-in-service',
      testing: 'status-testing',
      ready_to_ship: 'status-ready-to-ship',
      closed: 'status-closed',
    };
    return classes[status] || '';
  };

  const getPriorityClass = (priority: string) => {
    const classes: Record<string, string> = {
      low: 'priority-low',
      normal: 'priority-normal',
      high: 'priority-high',
      urgent: 'priority-urgent',
    };
    return classes[priority] || '';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <div className="flex items-center gap-3">
                <Watch className="h-6 w-6 text-accent" />
                <div>
                  <h1 className="text-xl font-serif font-semibold">Job {job.job_id}</h1>
                  <p className="text-sm text-muted-foreground">{job.customer?.first_name} {job.customer?.last_name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyJobLink}>
                {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              {permissions.canDeleteJobs && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timing">Timing Tests</TabsTrigger>
            <TabsTrigger value="pressure">Pressure Tests</TabsTrigger>
            <TabsTrigger value="parts">Parts & Labor</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={job.status} onValueChange={handleStatusChange}>
                    <SelectTrigger ref={statusSelectRef} className={`status-badge ${getStatusClass(job.status)} h-10`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>{JOB_STATUS_LABELS[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">Press S to change status</p>
                </CardContent>
              </Card>

              {/* Priority Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-lg font-semibold ${getPriorityClass(job.priority)}`}>
                    {PRIORITY_LABELS[job.priority]}
                  </p>
                </CardContent>
              </Card>

              {/* Due Date Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Due Date</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-semibold">
                    {job.due_date ? format(new Date(job.due_date), 'MMM d, yyyy') : 'Not set'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Test Status Badges */}
            <div className="flex gap-4">
              {latestTiming && (
                <Card className="flex-1">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <Gauge className="h-8 w-8 text-accent" />
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Timing Test</p>
                      <p className="font-semibold">{latestTiming.rate !== null ? `${latestTiming.rate} s/d` : 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(latestTiming.test_date), 'MMM d, yyyy')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {latestPressure && (
                <Card className={`flex-1 ${isPressurePassed ? 'border-success' : 'border-destructive'}`}>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <Droplets className={`h-8 w-8 ${isPressurePassed ? 'text-success' : 'text-destructive'}`} />
                    <div>
                      <p className="text-sm text-muted-foreground">Pressure Test</p>
                      <Badge variant={isPressurePassed ? 'default' : 'destructive'}>
                        {isPressurePassed ? 'Passed' : 'Failed'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(latestPressure.test_date), 'MMM d, yyyy')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Customer & Watch Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Customer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{job.customer?.first_name} {job.customer?.last_name}</p>
                  {job.customer?.email && <p className="text-sm text-muted-foreground">{job.customer.email}</p>}
                  {job.customer?.phone && <p className="text-sm text-muted-foreground">{job.customer.phone}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Watch className="h-5 w-5" />Watch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{job.watch?.brand} {job.watch?.model}</p>
                  {job.watch?.reference_number && <p className="text-sm text-muted-foreground">Part #: {job.watch.reference_number}</p>}
                  {job.watch?.serial_number && <p className="text-sm text-muted-foreground">S/N: {job.watch.serial_number}</p>}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {job.intake_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Intake Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{job.intake_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Quick Changes */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Set Status</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('awaiting_customer_approval')}>
                      Awaiting Approval
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('approved')}>
                      Approved
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('in_service')}>
                      In Service
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('testing')}>
                      Testing
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('ready_to_ship')}>
                      Ready to Ship
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('closed')}>
                      Closed
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                {/* Test & Document Actions */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Link to={`/jobs/${job.id}?tab=timing`}>
                    <Button variant="outline" className="justify-start w-full">
                      <Gauge className="h-4 w-4 mr-2" />
                      Add Timing Test
                    </Button>
                  </Link>
                  <Link to={`/jobs/${job.id}?tab=pressure`}>
                    <Button variant="outline" className="justify-start w-full">
                      <Droplets className="h-4 w-4 mr-2" />
                      Add Pressure Test
                    </Button>
                  </Link>
                  <Link to={`/jobs/${job.id}?tab=documents`}>
                    <Button variant="outline" className="justify-start w-full">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Test Card
                    </Button>
                  </Link>
                  <Button variant="outline" className="justify-start" onClick={copyJobLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy Job Link'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timing Tests Tab */}
          <TabsContent value="timing">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Timing Tests</CardTitle>
                  <CardDescription>Record and view timing test results</CardDescription>
                </div>
                <Button>Add Timing Test</Button>
              </CardHeader>
              <CardContent>
                {!timingTests?.length ? (
                  <p className="text-center text-muted-foreground py-8">No timing tests recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {timingTests.map((test) => (
                      <div key={test.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{format(new Date(test.test_date), 'MMM d, yyyy h:mm a')}</p>
                          {test.machine && <Badge variant="outline">{test.machine}</Badge>}
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div><span className="text-muted-foreground">Rate:</span> {test.rate ?? 'N/A'} s/d</div>
                          <div><span className="text-muted-foreground">Amplitude:</span> {test.amplitude ?? 'N/A'}°</div>
                          <div><span className="text-muted-foreground">Beat Error:</span> {test.beat_error ?? 'N/A'} ms</div>
                          <div><span className="text-muted-foreground">Lift Angle:</span> {test.lift_angle ?? 52}°</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pressure Tests Tab */}
          <TabsContent value="pressure">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pressure Tests</CardTitle>
                  <CardDescription>Record and view water resistance test results</CardDescription>
                </div>
                <Button>Add Pressure Test</Button>
              </CardHeader>
              <CardContent>
                {!pressureTests?.length ? (
                  <p className="text-center text-muted-foreground py-8">No pressure tests recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {pressureTests.map((test) => (
                      <div key={test.id} className={`p-4 border rounded-lg ${test.result_passed ? 'border-success/50' : 'border-destructive/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{format(new Date(test.test_date), 'MMM d, yyyy h:mm a')}</p>
                          <Badge variant={test.result_passed ? 'default' : 'destructive'}>
                            {test.result_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div><span className="text-muted-foreground">Method:</span> {test.method || 'N/A'}</div>
                          <div><span className="text-muted-foreground">Target:</span> {test.target_bar ?? 'N/A'} bar</div>
                          <div><span className="text-muted-foreground">Tester:</span> {test.tester || 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Parts & Labor Tab */}
          <TabsContent value="parts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Parts & Labor</CardTitle>
                  <CardDescription>Line items for this service order</CardDescription>
                </div>
                <Button>Add Line Item</Button>
              </CardHeader>
              <CardContent>
                {!lineItems?.length ? (
                  <p className="text-center text-muted-foreground py-8">No line items added yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3">Description</th>
                            <th className="text-right p-3">Qty</th>
                            <th className="text-right p-3">Price</th>
                            <th className="text-right p-3">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="p-3">{item.description}</td>
                              <td className="text-right p-3">{item.quantity}</td>
                              <td className="text-right p-3">${item.unit_price.toFixed(2)}</td>
                              <td className="text-right p-3">${(item.quantity * item.unit_price).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totals && (
                      <div className="flex justify-end">
                        <div className="w-64 space-y-1 text-sm">
                          <div className="flex justify-between"><span>Subtotal:</span><span>${totals.subtotal.toFixed(2)}</span></div>
                          <div className="flex justify-between text-muted-foreground"><span>Tax:</span><span>${totals.tax.toFixed(2)}</span></div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold"><span>Total:</span><span>${totals.total.toFixed(2)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Generate printable documents for this job</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Test Insert Card (5" x 7")
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  The Test Insert Card includes job details, customer information, and the latest test results.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activity Log</CardTitle>
                <CardDescription>Audit trail for this job</CardDescription>
              </CardHeader>
              <CardContent>
                {!activityLog?.length ? (
                  <p className="text-center text-muted-foreground py-8">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                        <div className="mt-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{entry.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">{entry.action_type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
