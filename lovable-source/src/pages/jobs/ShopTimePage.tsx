import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useServiceSubcategories } from '@/hooks/useServiceCategories';
import { Plus, Search, Loader2, Clock, Play, Square, Timer, Calendar, DollarSign } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

export default function ShopTimePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);

  const { data: subcategories } = useServiceSubcategories();

  // Fetch shop time entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['shop-time-entries', search],
    queryFn: async () => {
      let query = supabase
        .from('shop_time_entries')
        .select(`
          *,
          job:jobs(job_id, customer:customers(first_name, last_name)),
          service_subcategory:service_subcategories(name, service_code)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch settings for hourly rate
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('shop_time_hourly_rate')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch active jobs
  const { data: activeJobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_id, customer:customers(first_name, last_name)')
        .in('simple_status', ['on_hand'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Create manual entry
  const createEntry = useMutation({
    mutationFn: async (data: {
      job_id?: string;
      service_subcategory_id?: string;
      duration_minutes: number;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('shop_time_entries')
        .insert({
          ...data,
          is_manual_entry: true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-time-entries'] });
      setAddDialogOpen(false);
      toast({
        title: 'Time Logged',
        description: 'Shop time entry has been created.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Start timer
  const startTimer = (jobId: string) => {
    setActiveTimer(jobId);
    setTimerStart(new Date());
    toast({
      title: 'Timer Started',
      description: 'Tracking time for this job.',
    });
  };

  // Stop timer and create entry
  const stopTimer = async () => {
    if (!activeTimer || !timerStart) return;

    const durationMinutes = differenceInMinutes(new Date(), timerStart);
    
    if (durationMinutes < 1) {
      toast({
        title: 'Timer Too Short',
        description: 'Timer must run for at least 1 minute.',
        variant: 'destructive',
      });
      setActiveTimer(null);
      setTimerStart(null);
      return;
    }

    await supabase
      .from('shop_time_entries')
      .insert({
        job_id: activeTimer,
        start_time: timerStart.toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: durationMinutes,
        is_manual_entry: false,
      });

    queryClient.invalidateQueries({ queryKey: ['shop-time-entries'] });
    setActiveTimer(null);
    setTimerStart(null);
    toast({
      title: 'Timer Stopped',
      description: `${durationMinutes} minutes logged.`,
    });
  };

  const hourlyRate = settings?.shop_time_hourly_rate || 125;

  // Calculate today's stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEntries = entries?.filter(e => new Date(e.created_at) >= todayStart) || [];
  const todayMinutes = todayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const todayValue = (todayMinutes / 60) * hourlyRate;

  // Week stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  
  const weekEntries = entries?.filter(e => new Date(e.created_at) >= weekStart) || [];
  const weekMinutes = weekEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const weekValue = (weekMinutes / 60) * hourlyRate;

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Shop Time</h1>
          <p className="text-muted-foreground">Track and log labor time</p>
        </div>
        <div className="flex gap-2">
          {activeTimer ? (
            <Button variant="destructive" onClick={stopTimer}>
              <Square className="h-4 w-4 mr-2" />
              Stop Timer
            </Button>
          ) : (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Shop Time</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createEntry.mutate({
                    job_id: formData.get('job_id') as string || undefined,
                    service_subcategory_id: formData.get('service_subcategory_id') as string || undefined,
                    duration_minutes: parseInt(formData.get('duration_minutes') as string) || 0,
                    notes: formData.get('notes') as string || undefined,
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="job_id">Job (optional)</Label>
                    <Select name="job_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Select job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeJobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.job_id} - {job.customer?.first_name} {job.customer?.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="service_subcategory_id">Service (optional)</Label>
                    <Select name="service_subcategory_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Select service..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories?.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.service_code} - {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
                    <Input
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                      min={1}
                      required
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="What was done..."
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createEntry.isPending}>
                      {createEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Log Time
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Active Timer */}
      {activeTimer && timerStart && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="animate-pulse">
                  <Timer className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Timer Running</p>
                  <p className="text-sm text-muted-foreground">
                    Started at {format(timerStart, 'h:mm a')}
                  </p>
                </div>
              </div>
              <Button variant="destructive" onClick={stopTimer}>
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Time</p>
                <p className="text-2xl font-bold">{formatDuration(todayMinutes)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Value</p>
                <p className="text-2xl font-bold">${todayValue.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{formatDuration(weekMinutes)}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Week Value</p>
                <p className="text-2xl font-bold">${weekValue.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Timer for Active Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5" />
            Quick Timer
          </CardTitle>
          <CardDescription>Start a timer for an active job</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {activeJobs?.slice(0, 8).map((job) => (
              <Button
                key={job.id}
                variant="outline"
                className="justify-start"
                disabled={!!activeTimer}
                onClick={() => startTimer(job.id)}
              >
                <Play className="h-4 w-4 mr-2" />
                <span className="font-mono">{job.job_id}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : entries?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(entry.created_at), 'MMM d, yyyy')}</p>
                        {entry.start_time && (
                          <p className="text-muted-foreground">
                            {format(new Date(entry.start_time), 'h:mm a')} - 
                            {entry.end_time && format(new Date(entry.end_time), 'h:mm a')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.job ? (
                        <div>
                          <p className="font-mono font-medium">{entry.job.job_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.job.customer?.first_name} {entry.job.customer?.last_name}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.service_subcategory ? (
                        <div className="text-sm">
                          <p>{entry.service_subcategory.name}</p>
                          <p className="text-muted-foreground font-mono">
                            {entry.service_subcategory.service_code}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatDuration(entry.duration_minutes)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-success font-medium">
                        ${((entry.duration_minutes || 0) / 60 * hourlyRate).toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.is_manual_entry ? 'secondary' : 'outline'}>
                        {entry.is_manual_entry ? 'Manual' : 'Timer'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                        {entry.notes || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
