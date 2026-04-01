import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface Watch {
  id: string;
  customerId: string;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  serialNumber?: string;
  movementType?: string;
  caseMaterial?: string;
  bandMaterial?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
  };
  jobs?: any[];
}

interface WatchesResponse {
  watches: Watch[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface WatchFilters {
  search?: string;
  customerId?: string;
  brand?: string;
  page?: number;
  perPage?: number;
}

// Get all watches
export function useWatches(filters: WatchFilters = {}) {
  return useQuery<WatchesResponse>({
    queryKey: ['watches', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.customerId) params.append('customerId', filters.customerId);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.perPage) params.append('perPage', filters.perPage.toString());

      const { data } = await api.get(`/api/v1/watches?${params.toString()}`);
      return data;
    },
  });
}

// Get single watch
export function useWatch(id: string) {
  return useQuery<Watch>({
    queryKey: ['watch', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/watches/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

// Get watches by customer
export function useWatchesByCustomer(customerId: string) {
  return useQuery<Watch[]>({
    queryKey: ['watches', 'customer', customerId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/watches/customer/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });
}

// Create watch
export function useCreateWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watchData: Partial<Watch>) => {
      const { data } = await api.post('/api/v1/watches', watchData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watches'] });
    },
  });
}

// Update watch
export function useUpdateWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Watch> }) => {
      const response = await api.put(`/api/v1/watches/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watch', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['watches'] });
    },
  });
}

// Delete watch
export function useDeleteWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/watches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watches'] });
    },
  });
}
