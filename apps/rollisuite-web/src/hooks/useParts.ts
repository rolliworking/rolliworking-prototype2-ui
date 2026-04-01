import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface Part {
  id: string;
  partNumber: string;
  description: string;
  itemType: 'part' | 'labor' | 'service' | 'other';
  uom: 'each' | 'hour' | 'ft' | 'lb' | 'kg' | 'gram' | 'oz';
  defaultSellPrice?: number;
  averageCost?: number;
  reorderPoint?: number;
  reorderQty?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalQtyOnHand?: number;
  qtyAvailable?: number;
  stock?: any[];
}

interface PartsResponse {
  parts: Part[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface PartFilters {
  search?: string;
  itemType?: string;
  isActive?: boolean;
  page?: number;
  perPage?: number;
}

// Get all parts
export function useParts(filters: PartFilters = {}) {
  return useQuery<PartsResponse>({
    queryKey: ['parts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.itemType) params.append('itemType', filters.itemType);
      if (filters.isActive !== undefined)
        params.append('isActive', filters.isActive.toString());
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.perPage) params.append('perPage', filters.perPage.toString());

      const { data } = await api.get(`/api/v1/parts?${params.toString()}`);
      return data;
    },
  });
}

// Get single part
export function usePart(id: string) {
  return useQuery<Part>({
    queryKey: ['part', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/parts/${id}`);
      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

// Get low stock parts
export function useLowStockParts() {
  return useQuery<Part[]>({
    queryKey: ['parts', 'low-stock'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/parts/low-stock');
      return data;
    },
  });
}

// Create part
export function useCreatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partData: Partial<Part>) => {
      const { data } = await api.post('/api/v1/parts', partData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// Update part
export function useUpdatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Part> }) => {
      const response = await api.put(`/api/v1/parts/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['part', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// Delete part
export function useDeletePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/parts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// Adjust inventory
export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      partId: string;
      binId: string;
      adjustment: number;
      reason: string;
    }) => {
      const response = await api.post('/api/v1/parts/adjust', data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['part', variables.partId] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}
