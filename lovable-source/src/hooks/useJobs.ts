import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Job, JobFormData, JobStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeSearchTerm } from '@/lib/sanitize';

export function useJobs(filters?: {
  status?: JobStatus;
  customerId?: string;
  search?: string;
  overdueOnly?: boolean;
  dueTodayOnly?: boolean;
}) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          watch:watches(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      if (filters?.overdueOnly) {
        query = query.lt('due_date', new Date().toISOString().split('T')[0]).neq('status', 'closed');
      }

      if (filters?.dueTodayOnly) {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('due_date', today);
      }

      if (filters?.search) {
        const sanitizedSearch = sanitizeSearchTerm(filters.search);
        query = query.or(`job_id.ilike.%${sanitizedSearch}%,estimate_number.ilike.%${sanitizedSearch}%`);
      }

      // Add limit to prevent unbounded queries (matches estimates pattern)
      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useJob(jobId: string) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          watch:watches(*)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data as Job;
    },
    enabled: !!jobId,
  });
}

export function useNextJobId() {
  return useQuery({
    queryKey: ['next-job-id'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_next_job_id');
      if (error) throw error;
      return data as string;
    },
    staleTime: 0, // Always refetch
  });
}

export function useCheckJobIdExists() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.rpc('job_id_exists', { p_job_id: jobId });
      if (error) throw error;
      return data as boolean;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      customerId,
      watchId,
      jobData,
    }: {
      customerId: string;
      watchId: string;
      jobData: JobFormData;
    }) => {
      // First check if job ID exists
      const { data: exists } = await supabase.rpc('job_id_exists', { p_job_id: jobData.job_id });
      if (exists) {
        throw new Error(`Job ID ${jobData.job_id} already exists. Please use a different Job ID.`);
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          job_id: jobData.job_id,
          customer_id: customerId,
          watch_id: watchId,
          estimate_number: jobData.estimate_number || null,
          status: jobData.status,
          priority: jobData.priority,
          due_date: jobData.due_date || null,
          intake_notes: jobData.intake_notes || null,
          condition_notes: jobData.condition_notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('job_activity_log').insert({
        job_id: data.id,
        action_type: 'Created',
        message: `Job ${jobData.job_id} created`,
        user_id: user?.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['next-job-id'] });
      toast({
        title: 'Job Created',
        description: 'The service order has been created successfully.',
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
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      jobId,
      data,
      logMessage,
    }: {
      jobId: string;
      data: Partial<Job>;
      logMessage?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('jobs')
        .update(data)
        .eq('id', jobId)
        .select()
        .single();

      if (error) throw error;

      // Log activity if message provided
      if (logMessage) {
        await supabase.from('job_activity_log').insert({
          job_id: jobId,
          action_type: 'Updated',
          message: logMessage,
          user_id: user?.id,
        });
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
      toast({
        title: 'Job Updated',
        description: 'The service order has been updated.',
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
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      jobId,
      oldStatus,
      newStatus,
    }: {
      jobId: string;
      oldStatus: JobStatus;
      newStatus: JobStatus;
    }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId)
        .select()
        .single();

      if (error) throw error;

      // Log status change
      await supabase.from('job_activity_log').insert({
        job_id: jobId,
        action_type: 'StatusChanged',
        message: `Status changed from "${oldStatus}" to "${newStatus}"`,
        user_id: user?.id,
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-activity', variables.jobId] });
      toast({
        title: 'Status Updated',
        description: 'The job status has been changed.',
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
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { permissions } = useAuth();

  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!permissions.canDeleteJobs) {
        throw new Error('Permission denied: You do not have permission to delete jobs.');
      }

      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Job Deleted',
        description: 'The service order has been deleted.',
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
}

export function useJobActivityLog(jobId: string) {
  return useQuery({
    queryKey: ['job-activity', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_activity_log')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(100); // Limit activity log to most recent entries

      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}
