import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface EstimateLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  partId?: string;
  lineType: string;
  sortOrder?: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  status: 'draft' | 'sent' | 'approved' | 'converted' | 'declined' | 'expired' | 'on_hold';
  serviceType?: string;
  totalAmount: number;
  sentAt?: string;
  approvedAt?: string;
  convertedAt?: string;
  expiresAt?: string;
  notes?: string;
  internalNotes?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: any;
  lineItems?: EstimateLineItem[];
}

interface EstimateSearchParams {
  customerId?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

interface EstimateSearchResult {
  estimates: Estimate[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function useEstimates(params: EstimateSearchParams = {}) {
  return useQuery({
    queryKey: ['estimates', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.customerId) searchParams.set('customerId', params.customerId);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.perPage) searchParams.set('perPage', String(params.perPage));

      const { data } = await api.get<{ success: boolean } & EstimateSearchResult>(
        `/api/estimates?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['estimate', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; estimate: Estimate }>(
        `/api/estimates/${id}`
      );
      return data.estimate;
    },
    enabled: !!id,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (estimateData: { customerId: string; serviceType?: string; notes?: string; internalNotes?: string; lineItems?: Partial<EstimateLineItem>[] }) => {
      const { data } = await api.post<{ success: boolean; estimate: Estimate }>(
        '/api/estimates',
        estimateData
      );
      return data.estimate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

export function useUpdateEstimate(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (estimateData: Partial<Estimate>) => {
      const { data } = await api.put<{ success: boolean; estimate: Estimate }>(
        `/api/estimates/${id}`,
        estimateData
      );
      return data.estimate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
    },
  });
}

export function useConvertEstimate(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; salesOrder: any }>(
        `/api/estimates/${id}/convert`
      );
      return data.salesOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });
}

export function useSendEstimate(id: string) {
  return useMutation({
    mutationFn: async (emailData: { toEmail: string; subject?: string; body?: string; sendCopy?: boolean }) => {
      const { data } = await api.post(
        `/api/estimates/${id}/send`,
        emailData
      );
      return data;
    },
  });
}

export function useDeleteEstimate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/estimates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}
