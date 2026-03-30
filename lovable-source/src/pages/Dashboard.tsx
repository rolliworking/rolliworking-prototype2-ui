import { useState, useMemo, useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useJobs } from '@/hooks/useJobs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, Clock, AlertTriangle, CheckCircle, Watch, LogOut, Package, Truck, Database } from 'lucide-react';
import { JOB_STATUS_LABELS, formatJobIdForSearch } from '@/lib/constants';
import { Job } from '@/types/database';
import { differenceInDays } from 'date-fns';

export default function Dashboard() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const { user, loading, signOut, role } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  
  // Normalize search: if just digits, interpret as E#### format
  const normalizedSearch = useMemo(() => formatJobIdForSearch(searchInput), [searchInput]);
  
  const { data: allJobs, isLoading: jobsLoading } = useJobs();
  const { data: overdueJobs } = useJobs({ overdueOnly: true });
  const { data: awaitingApproval } = useJobs({ status: 'awaiting_customer_approval' });
  const { data: inTesting } = useJobs({ status: 'testing' });
  const { data: readyToShip } = useJobs({ status: 'ready_to_ship' });

  // Fetch QBO token status
  const { data: qboToken } = useQuery({
    queryKey: ['qbo-token-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_tokens')
        .select('updated_at, environment')
        .eq('environment', 'production')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Calculate days remaining on QBO token (100-day lifespan)
  const qboDaysRemaining = useMemo(() => {
    if (!qboToken?.updated_at) return null;
    const updatedAt = new Date(qboToken.updated_at);
    const expiresAt = new Date(updatedAt.getTime() + 100 * 24 * 60 * 60 * 1000);
    return Math.max(0, differenceInDays(expiresAt, new Date()));
  }, [qboToken]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Filter jobs by search (job_id, customer name, serial number)
  const filteredJobs = useMemo(() => {
    if (!allJobs) return [];
    if (!searchInput.trim()) return allJobs.slice(0, 15);
    
    const search = normalizedSearch.toLowerCase();
    return allJobs.filter(job => 
      job.job_id.toLowerCase().includes(search) ||
      job.estimate_number?.toLowerCase().includes(search) ||
      `${job.customer?.first_name} ${job.customer?.last_name}`.toLowerCase().includes(search) ||
      job.watch?.serial_number?.toLowerCase().includes(search) ||
      job.watch?.brand?.toLowerCase().includes(search)
    ).slice(0, 15);
  }, [allJobs, searchInput, normalizedSearch]);

  // Count open jobs (not closed)
  const openJobsCount = allJobs?.filter(j => j.status !== 'closed').length || 0;

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

  const getPriorityIcon = (priority: string) => {
    if (priority === 'urgent') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (priority === 'high') return <AlertTriangle className="h-4 w-4 text-warning" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Watch className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-2xl font-serif font-semibold">RolliSuite</h1>
              <p className="text-xs text-muted-foreground capitalize">{role} Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/jobs/new">
              <Button><Plus className="h-4 w-4 mr-2" />New Job</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open Jobs</CardDescription>
              <CardTitle className="text-3xl">{openJobsCount}</CardTitle>
            </CardHeader>
            <CardContent><Package className="h-5 w-5 text-muted-foreground" /></CardContent>
          </Card>
          <Card className={overdueJobs?.length ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
              <CardTitle className="text-3xl text-destructive">{overdueJobs?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent><AlertTriangle className="h-5 w-5 text-destructive" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Awaiting Approval</CardDescription>
              <CardTitle className="text-3xl">{awaitingApproval?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent><Clock className="h-5 w-5 text-warning" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Testing</CardDescription>
              <CardTitle className="text-3xl">{inTesting?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent><CheckCircle className="h-5 w-5 text-accent" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ready to Ship</CardDescription>
              <CardTitle className="text-3xl">{readyToShip?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent><Truck className="h-5 w-5 text-success" /></CardContent>
          </Card>
          <Link to="/setup/qbo-customers">
            <Card className={qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'border-destructive' : ''}>
              <CardHeader className="pb-2">
                <CardDescription>QBO Token</CardDescription>
                <CardTitle className={`text-3xl ${qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'text-destructive' : ''}`}>
                  {qboDaysRemaining !== null ? `${qboDaysRemaining}d` : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent><Database className={`h-5 w-5 ${qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'text-destructive' : 'text-muted-foreground'}`} /></CardContent>
            </Card>
          </Link>
        </div>

        {/* Jobs List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>Recent Jobs</CardTitle>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  ref={searchInputRef}
                  placeholder="Search by Job ID, customer, or serial... (press /)" 
                  className="pl-9" 
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)} 
                />
                {searchInput && /^\d+$/.test(searchInput.trim()) && (
                  <p className="absolute -bottom-5 left-0 text-xs text-muted-foreground">
                    Searching as E{searchInput.trim()}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <Watch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchInput ? 'No jobs match your search.' : 'No jobs found. Create your first job to get started.'}
                </p>
                {!searchInput && (
                  <Link to="/jobs/new">
                    <Button><Plus className="h-4 w-4 mr-2" />Create First Job</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredJobs.map((job) => (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="block">
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(job.priority)}
                          <span className="font-mono font-semibold text-accent">{job.job_id}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{job.customer?.first_name} {job.customer?.last_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {job.watch?.brand} {job.watch?.model}
                            {job.watch?.serial_number && <span className="ml-2 opacity-75">S/N: {job.watch.serial_number}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {job.due_date && (
                          <span className="text-sm text-muted-foreground hidden md:block">
                            {new Date(job.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <Badge className={`status-badge ${getStatusClass(job.status)}`}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
