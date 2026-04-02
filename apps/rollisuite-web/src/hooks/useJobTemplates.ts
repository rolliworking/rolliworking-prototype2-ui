import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface JobTemplate {
  id: string;
  name: string;
  description?: string;
  serviceType?: 'repair' | 'restoration' | 'appraisal' | 'consignment';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimatedDays?: number;
  defaultPrice?: number;
  intakeNotes?: string;
  conditionNotes?: string;
  instructions?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JobTemplatesResponse {
  success: boolean;
  data: JobTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useJobTemplates(params?: {
  page?: number;
  limit?: number;
  search?: string;
  serviceType?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: ['job-templates', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.search) searchParams.append('search', params.search);
      if (params?.serviceType) searchParams.append('serviceType', params.serviceType);
      if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());

      const { data } = await api.get<JobTemplatesResponse>(
        `/v1/job-templates?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useJobTemplate(id: string) {
  return useQuery({
    queryKey: ['job-templates', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: JobTemplate }>(
        `/v1/job-templates/${id}`
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<JobTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/v1/job-templates', template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
    },
  });
}

export function useUpdateJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<JobTemplate> & { id: string }) => {
      const { data } = await api.patch(`/v1/job-templates/${id}`, template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
    },
  });
}

export function useDeleteJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/v1/job-templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
    },
  });
}

export function useDuplicateJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/v1/job-templates/${id}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
    },
  });
}
