import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  htmlBody: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplatesResponse {
  success: boolean;
  data: EmailTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TemplateVariable {
  key: string;
  description: string;
}

interface TemplateVariables {
  customer: TemplateVariable[];
  estimate: TemplateVariable[];
  job: TemplateVariable[];
  salesOrder: TemplateVariable[];
  watch: TemplateVariable[];
  company: TemplateVariable[];
  system: TemplateVariable[];
}

export function useEmailTemplates(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: ['email-templates', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.search) searchParams.append('search', params.search);
      if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());

      const { data } = await api.get<EmailTemplatesResponse>(
        `/v1/email-templates?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: ['email-templates', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: EmailTemplate }>(
        `/v1/email-templates/${id}`
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: ['email-templates', 'variables'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: TemplateVariables }>(
        '/v1/email-templates/variables'
      );
      return data.data;
    },
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/v1/email-templates', template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<EmailTemplate> & { id: string }) => {
      const { data } = await api.patch(`/v1/email-templates/${id}`, template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/v1/email-templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });
}

export function useDuplicateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/v1/email-templates/${id}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
  });
}
