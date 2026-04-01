import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface Job {
  id: string;
  jobId: string;
  estimateNumber?: string;
  quickbooksInvoiceId?: string;
  customerId: string;
  watchId: string;
  status: 'intake' | 'in_review' | 'awaiting_customer_approval' | 'approved' | 'in_service' | 'testing' | 'ready_to_ship' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  intakeNotes?: string;
  conditionNotes?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  customer?: any;
  watch?: any;
  assignee?: any;
  statusHistory?: any[];
  activityLog?: any[];
  timingTests?: any[];
  pressureTests?: any[];
}

interface JobSearchParams {
  customerId?: string;
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

interface JobSearchResult {
  jobs: Job[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function useJobs(params: JobSearchParams = {}) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.customerId) searchParams.set('customerId', params.customerId);
      if (params.status) searchParams.set('status', params.status);
      if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo);
      if (params.search) searchParams.set('search', params.search);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.perPage) searchParams.set('perPage', String(params.perPage));

      const { data } = await api.get<{ success: boolean } & JobSearchResult>(
        `/api/jobs?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; job: Job }>(
        `/api/jobs/${id}`
      );
      return data.job;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobData: {
      estimateNumber?: string;
      customerId: string;
      watchId: string;
      status?: string;
      priority?: string;
      dueDate?: string;
      intakeNotes?: string;
      conditionNotes?: string;
      assignedTo?: string;
    }) => {
      const { data } = await api.post<{ success: boolean; job: Job }>(
        '/api/jobs',
        jobData
      );
      return data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJob(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobData: Partial<Job>) => {
      const { data } = await api.put<{ success: boolean; job: Job }>(
        `/api/jobs/${id}`,
        jobData
      );
      return data.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', id] });
    },
  });
}

export function useAssignJob(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (watchmakerId: string) => {
      const { data } = await api.post(
        `/api/jobs/${id}/assign`,
        { watchmakerId }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', id] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
