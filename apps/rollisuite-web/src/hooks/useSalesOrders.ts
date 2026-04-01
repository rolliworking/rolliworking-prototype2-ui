import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface SalesOrderLineItem {
  id?: string;
  partId: string;
  qtyOrdered: number;
  qtyAllocated: number;
  qtyShipped: number;
  unitPrice: number;
  unitCost?: number;
  extendedPrice: number;
  notes?: string;
  sortOrder?: number;
  part?: any;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  jobId?: string;
  orderDate: string;
  shipDate?: string;
  status: 'draft' | 'pending' | 'fulfilled' | 'cancelled' | 'invoiced';
  subtotal?: number;
  shippingAmount?: number;
  totalAmount?: number;
  notes?: string;
  workCompletedSent: boolean;
  qboInvoiceId?: string;
  isPaid: boolean;
  balanceDue?: number;
  tcAgreed: boolean;
  tcAgreedAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: any;
  job?: any;
  lineItems?: SalesOrderLineItem[];
  tcAcceptances?: any[];
}

interface SalesOrderSearchParams {
  customerId?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

interface SalesOrderSearchResult {
  salesOrders: SalesOrder[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function useSalesOrders(params: SalesOrderSearchParams = {}) {
  return useQuery({
    queryKey: ['sales-orders', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.customerId) searchParams.set('customerId', params.customerId);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.perPage) searchParams.set('perPage', String(params.perPage));

      const { data } = await api.get<{ success: boolean } & SalesOrderSearchResult>(
        `/api/sales-orders?${searchParams.toString()}`
      );
      return data;
    },
  });
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: ['sales-order', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; salesOrder: SalesOrder }>(
        `/api/sales-orders/${id}`
      );
      return data.salesOrder;
    },
    enabled: !!id,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: {
      customerId: string;
      jobId?: string;
      shipDate?: string;
      notes?: string;
      lineItems: Partial<SalesOrderLineItem>[];
    }) => {
      const { data } = await api.post<{ success: boolean; salesOrder: SalesOrder }>(
        '/api/sales-orders',
        orderData
      );
      return data.salesOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });
}

export function useUpdateSalesOrder(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: Partial<SalesOrder>) => {
      const { data } = await api.put<{ success: boolean; salesOrder: SalesOrder }>(
        `/api/sales-orders/${id}`,
        orderData
      );
      return data.salesOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
    },
  });
}

export function useSyncToQBO(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        `/api/sales-orders/${id}/sync-qbo`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
    },
  });
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/sales-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });
}
