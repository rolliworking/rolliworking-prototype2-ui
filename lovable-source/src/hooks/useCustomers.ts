import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, CustomerFormData, CustomerAddress, CustomerCommunicationPermissions } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSearchTerm } from '@/lib/sanitize';

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('display_name', { ascending: true });

      if (search) {
        const sanitizedSearch = sanitizeSearchTerm(search);
        query = query.or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,display_name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%`);
      }

      // Add limit to prevent unbounded queries - full list uses pagination in CustomersPage
      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_organization', true)
        .order('display_name', { ascending: true })
        .limit(200);

      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useChildCustomers(parentCustomerId: string) {
  return useQuery({
    queryKey: ['child-customers', parentCustomerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_customer_id', parentCustomerId)
        .order('display_name', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!parentCustomerId,
  });
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    enabled: !!customerId,
  });
}

export function useCustomerAddresses(customerId: string) {
  return useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;
      return data as CustomerAddress[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerCommunicationPermissions(customerId: string) {
  return useQuery({
    queryKey: ['customer-communication', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_communication_permissions')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      return data as CustomerCommunicationPermissions | null;
    },
    enabled: !!customerId,
  });
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  exactMatch: Customer | null;
  softMatches: Customer[];
}

export function useCheckDuplicateCustomer() {
  return useMutation({
    mutationFn: async ({
      email,
      phone,
      lastName,
      city,
      state,
      excludeCustomerId,
    }: {
      email?: string;
      phone?: string;
      lastName?: string;
      city?: string;
      state?: string;
      excludeCustomerId?: string;
    }): Promise<DuplicateCheckResult> => {
      let exactMatch: Customer | null = null;
      const softMatches: Customer[] = [];

      // Check for exact email match
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        let query = supabase
          .from('customers')
          .select('*')
          .eq('email_normalized', normalizedEmail);
        
        if (excludeCustomerId) {
          query = query.neq('id', excludeCustomerId);
        }
        
        const { data } = await query;
        if (data && data.length > 0) {
          exactMatch = data[0] as Customer;
        }
      }

      // Check for exact phone match if no email match
      if (!exactMatch && phone) {
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        if (normalizedPhone.length >= 10) {
          let query = supabase
            .from('customers')
            .select('*')
            .eq('phone_normalized', normalizedPhone);
          
          if (excludeCustomerId) {
            query = query.neq('id', excludeCustomerId);
          }
          
          const { data } = await query;
          if (data && data.length > 0) {
            exactMatch = data[0] as Customer;
          }
        }
      }

      // Check for soft matches (same last name + city/state)
      if (!exactMatch && lastName && (city || state)) {
        let query = supabase
          .from('customers')
          .select('*')
          .ilike('last_name', lastName);
        
        if (city) {
          query = query.ilike('city', city);
        }
        if (state) {
          query = query.ilike('state', state);
        }
        if (excludeCustomerId) {
          query = query.neq('id', excludeCustomerId);
        }
        
        const { data } = await query.limit(5);
        if (data && data.length > 0) {
          softMatches.push(...(data as Customer[]));
        }
      }

      return {
        isDuplicate: !!exactMatch,
        exactMatch,
        softMatches,
      };
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customerData: CustomerFormData) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Customer Created',
        description: 'The customer has been added successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      customerId,
      data,
    }: {
      customerId: string;
      data: Partial<CustomerFormData>;
    }) => {
      const { data: result, error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;
      return result as Customer;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
      toast({
        title: 'Customer Updated',
        description: 'The customer information has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSaveCustomerAddresses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      billing,
      shipping,
    }: {
      customerId: string;
      billing?: {
        street1?: string;
        street2?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      };
      shipping?: {
        street1?: string;
        street2?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
        is_same_as_billing?: boolean;
      };
    }) => {
      // Upsert billing address
      if (billing) {
        const { error: billingError } = await supabase
          .from('customer_addresses')
          .upsert({
            customer_id: customerId,
            address_type: 'billing',
            ...billing,
          }, {
            onConflict: 'customer_id,address_type',
          });
        if (billingError) throw billingError;
      }

      // Upsert shipping address
      if (shipping) {
        const { error: shippingError } = await supabase
          .from('customer_addresses')
          .upsert({
            customer_id: customerId,
            address_type: 'shipping',
            ...shipping,
          }, {
            onConflict: 'customer_id,address_type',
          });
        if (shippingError) throw shippingError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', variables.customerId] });
    },
  });
}

export function useSaveCustomerCommunicationPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      consent_email,
      consent_recorded,
    }: {
      customerId: string;
      consent_email?: string;
      consent_recorded?: boolean;
    }) => {
      const { error } = await supabase
        .from('customer_communication_permissions')
        .upsert({
          customer_id: customerId,
          consent_email,
          consent_recorded,
          consent_recorded_at: consent_recorded ? new Date().toISOString() : null,
        }, {
          onConflict: 'customer_id',
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-communication', variables.customerId] });
    },
  });
}
