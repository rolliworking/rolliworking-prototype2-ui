import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  isShipDirect: boolean;
  isTradePricing: boolean;
  skipShippingInfo: boolean;
  qboCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerSearchParams {
  search?: string;
  isShipDirect?: boolean;
  isTradePricing?: boolean;
  page?: number;
  perPage?: number;
}

interface CustomerSearchResult {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function useCustomers(params: CustomerSearchParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set('search', params.search);
      if (params.isShipDirect !== undefined) searchParams.set('isShipDirect', String(params.isShipDirect));
      if (params.isTradePricing !== undefined) searchParams.set('isTradePricing', String(params.isTradePricing));
      if (params.page) searchParams.set('page', String(params.page));
      if (params.perPage) searchParams.set('perPage', String(params.perPage));

      const { data } = await api.get<{ success: boolean; data: CustomerSearchResult }>(
        `/api/customers?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; customer: Customer }>(
        `/api/customers/${id}`
      );
      return data.customer;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerData: Partial<Customer>) => {
      const { data } = await api.post<{ success: boolean; customer: Customer }>(
        '/api/customers',
        customerData
      );
      return data.customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerData: Partial<Customer>) => {
      const { data } = await api.put<{ success: boolean; customer: Customer }>(
        `/api/customers/${id}`,
        customerData
      );
      return data.customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
