import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface WaitlistEntry {
  id: string;
  customerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  brand?: string;
  model?: string;
  serviceType?: 'repair' | 'restoration' | 'appraisal' | 'consignment';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'waiting' | 'contacted' | 'scheduled' | 'converted' | 'declined' | 'cancelled';
  estimatedValue?: number;
  notes?: string;
  contactedAt?: string;
  convertedAt?: string;
  convertedToId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

interface WaitlistResponse {
  success: boolean;
  data: WaitlistEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WaitlistStats {
  totalWaiting: number;
  totalContacted: number;
  totalConverted: number;
  highPriority: number;
  urgentPriority: number;
}

export function useWaitlist(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['waitlist', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.status) searchParams.append('status', params.status);
      if (params?.priority) searchParams.append('priority', params.priority);
      if (params?.search) searchParams.append('search', params.search);

      const { data } = await api.get<WaitlistResponse>(
        `/v1/waitlist?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useWaitlistEntry(id: string) {
  return useQuery({
    queryKey: ['waitlist', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: WaitlistEntry }>(
        `/v1/waitlist/${id}`
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useWaitlistStats() {
  return useQuery({
    queryKey: ['waitlist', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: WaitlistStats }>(
        '/v1/waitlist/stats'
      );
      return data.data;
    },
  });
}

export function useCreateWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
      const { data } = await api.post('/v1/waitlist', entry);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useUpdateWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...entry }: Partial<WaitlistEntry> & { id: string }) => {
      const { data } = await api.patch(`/v1/waitlist/${id}`, entry);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useDeleteWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/v1/waitlist/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useContactWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data} = await api.post(`/v1/waitlist/${id}/contact`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useConvertWaitlistEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, convertedToId, convertedToType }: { 
      id: string; 
      convertedToId: string;
      convertedToType?: string;
    }) => {
      const { data } = await api.post(`/v1/waitlist/${id}/convert`, {
        convertedToId,
        convertedToType,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}
