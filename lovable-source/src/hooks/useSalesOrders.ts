import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  job_id: string | null;
  order_date: string;
  ship_date: string | null;
  status: 'draft' | 'open' | 'partial_fulfilled' | 'fulfilled' | 'cancelled';
  subtotal: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  work_completed_sent: boolean;
  qbo_invoice_id: string | null;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    qbo_customer_id: string | null;
  };
  jobs?: {
    id: string;
    job_id: string;
  };
}

export interface SalesOrderLine {
  id: string;
  so_id: string;
  part_id: string;
  qty_ordered: number;
  qty_allocated: number;
  qty_shipped: number;
  unit_price: number;
  unit_cost: number | null;
  extended_price: number;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  parts?: {
    id: string;
    part_number: string;
    description: string;
    default_sell_price: number | null;
    average_cost: number | null;
  };
}

export function useSalesOrders(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['sales-orders', filters],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select(`
          *,
          customers (id, first_name, last_name, display_name, company_name, email, phone, address, city, state, zip, qbo_customer_id),
          jobs (id, job_id)
        `)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`so_number.ilike.%${filters.search}%`);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data as unknown) as SalesOrder[];
    },
  });
}

export function useSalesOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['sales-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (id, first_name, last_name, display_name, company_name, email, phone, address, city, state, zip, qbo_customer_id),
          jobs (id, job_id)
        `)
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return (data as unknown) as SalesOrder;
    },
    enabled: !!orderId,
  });
}

export function useSalesOrderLines(orderId: string | undefined) {
  return useQuery({
    queryKey: ['sales-order-lines', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('so_lines')
        .select(`
          *,
          parts (id, part_number, description, default_sell_price, average_cost)
        `)
        .eq('so_id', orderId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as SalesOrderLine[];
    },
    enabled: !!orderId,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      customer_id: string;
      job_id?: string | null;
      order_date?: string;
      ship_date?: string | null;
      notes?: string | null;
    }) => {
      // Get next SO number - use highest existing SO + 4 pattern
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('id, next_so_number')
        .single();
      
      if (settingsError) throw settingsError;
      const settingsId = (settingsData as { id: string; next_so_number: number | null }).id;
      const settingsNextNum = (settingsData as { id: string; next_so_number: number | null }).next_so_number ?? 1;
      
      // Get highest existing SO number from database
      const { data: highestSO } = await supabase
        .from('sales_orders')
        .select('so_number')
        .order('so_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let nextNum = settingsNextNum;
      
      // If there's an existing SO, parse the numeric part and add 4
      if (highestSO?.so_number) {
        const match = highestSO.so_number.match(/(\d+)/);
        if (match) {
          const highestNum = parseInt(match[1], 10);
          nextNum = Math.max(nextNum, highestNum + 4);
        }
      }
      
      const soNumber = `SO-${String(nextNum).padStart(5, '0')}`;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          ...data,
          so_number: soNumber,
          status: 'draft' as const,
          subtotal: 0,
          shipping_amount: 0,
          total_amount: 0,
        } as any)
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      // Update next_so_number to be ready for next order (+4 from current)
      await supabase
        .from('settings')
        .update({ next_so_number: nextNum + 4 })
        .eq('id', settingsId);
      
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Sales order created');
    },
    onError: (error) => {
      toast.error('Failed to create sales order: ' + error.message);
    },
  });
}

type SoStatus = 'draft' | 'open' | 'partial_fulfilled' | 'fulfilled' | 'cancelled';

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      so_number?: string;
      customer_id?: string;
      job_id?: string | null;
      order_date?: string;
      ship_date?: string | null;
      status?: SoStatus;
      subtotal?: number;
      shipping_amount?: number;
      total_amount?: number;
      notes?: string | null;
      qbo_invoice_id?: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: order, error } = await supabase
        .from('sales_orders')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return order;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', variables.id] });
    },
    onError: (error) => {
      toast.error('Failed to update sales order: ' + error.message);
    },
  });
}

export function useAddSalesOrderLine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      so_id: string;
      part_id: string;
      qty_ordered: number;
      unit_price: number;
      unit_cost?: number | null;
      notes?: string | null;
    }) => {
      const extended_price = data.qty_ordered * data.unit_price;
      
      const { data: line, error } = await supabase
        .from('so_lines')
        .insert({
          ...data,
          extended_price,
          qty_allocated: 0,
          qty_shipped: 0,
        })
        .select(`
          *,
          parts (id, part_number, description, default_sell_price, average_cost)
        `)
        .single();
      
      if (error) throw error;
      return (line as unknown) as SalesOrderLine;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-lines', variables.so_id] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', variables.so_id] });
    },
    onError: (error) => {
      toast.error('Failed to add line: ' + error.message);
    },
  });
}

export function useUpdateSalesOrderLine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, so_id, ...data }: {
      id: string;
      so_id: string;
      qty_ordered?: number;
      qty_allocated?: number;
      qty_shipped?: number;
      unit_price?: number;
      extended_price?: number;
      notes?: string | null;
    }) => {
      const { data: line, error } = await supabase
        .from('so_lines')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return line;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-lines', variables.so_id] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', variables.so_id] });
    },
    onError: (error) => {
      toast.error('Failed to update line: ' + error.message);
    },
  });
}

export function useDeleteSalesOrderLine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, so_id }: { id: string; so_id: string }) => {
      const { error } = await supabase
        .from('so_lines')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-lines', variables.so_id] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', variables.so_id] });
    },
    onError: (error) => {
      toast.error('Failed to delete line: ' + error.message);
    },
  });
}

export function useRecalculateSalesOrderTotals() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderId: string) => {
      // Get all lines
      const { data: lines, error: linesError } = await supabase
        .from('so_lines')
        .select('extended_price')
        .eq('so_id', orderId);
      
      if (linesError) throw linesError;
      
      // Get current order for shipping
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .select('shipping_amount')
        .eq('id', orderId)
        .single();
      
      if (orderError) throw orderError;
      
      const subtotal = lines?.reduce((sum, l) => sum + (l.extended_price || 0), 0) || 0;
      const shipping = order?.shipping_amount || 0;
      const total = subtotal + shipping;
      
      // Update order
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({
          subtotal,
          total_amount: total,
        })
        .eq('id', orderId);
      
      if (updateError) throw updateError;
      
      return { subtotal, total };
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });
}
