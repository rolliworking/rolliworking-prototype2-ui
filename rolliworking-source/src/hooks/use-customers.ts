import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Customer = Tables<"customers">;
export type CustomerInsert = TablesInsert<"customers">;

export const CUSTOMERS_PAGE_SIZE = 50;

export interface PaginatedCustomersResult {
  customers: Customer[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export function useCustomersPaginated(search: string, page: number) {
  return useQuery({
    queryKey: ["customers", "paginated", search, page],
    queryFn: async (): Promise<PaginatedCustomersResult> => {
      const searchTerm = search?.trim() || "";
      const from = (page - 1) * CUSTOMERS_PAGE_SIZE;
      const to = from + CUSTOMERS_PAGE_SIZE - 1;

      // Get total count first
      let countQuery = supabase
        .from("customers")
        .select("*", { count: "exact", head: true });

      if (searchTerm) {
        countQuery = countQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE);

      // Get paginated data
      let dataQuery = supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true })
        .range(from, to);

      if (searchTerm) {
        dataQuery = dataQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      return {
        customers: (data || []) as Customer[],
        totalCount,
        totalPages,
        currentPage: page,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    placeholderData: (prev) => prev, // Keep previous data while loading
  });
}

// Legacy hook for backward compatibility
export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      const searchTerm = search?.trim() || "";
      
      let query = supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data: directMatches, error: directError } = await query.limit(100);
      if (directError) throw directError;

      // If search term looks like a reference number, also search watches
      if (searchTerm && searchTerm.length >= 3) {
        const { data: watchMatches, error: watchError } = await supabase
          .from("watches")
          .select("customer_id, customers!inner(id, name, email, phone, created_at, updated_at, created_by)")
          .or(`reference_number.ilike.%${searchTerm}%,estimate_number.ilike.%${searchTerm}%`)
          .limit(50);

        if (!watchError && watchMatches) {
          const watchCustomers = watchMatches
            .map((w: any) => w.customers)
            .filter(Boolean) as Customer[];

          const allCustomers = [...(directMatches || [])];
          const existingIds = new Set(allCustomers.map((c) => c.id));
          
          for (const customer of watchCustomers) {
            if (!existingIds.has(customer.id)) {
              allCustomers.push(customer);
              existingIds.add(customer.id);
            }
          }

          return allCustomers;
        }
      }

      return (directMatches || []) as Customer[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Find existing customer by name and email match
export async function findExistingCustomer(name: string, email?: string): Promise<Customer | null> {
  const trimmedName = name.trim().toLowerCase();
  const trimmedEmail = email?.trim().toLowerCase();

  // Build query - match by name (case-insensitive)
  let query = supabase
    .from("customers")
    .select("*")
    .ilike("name", trimmedName);

  // If email provided, also match by email
  if (trimmedEmail) {
    query = query.ilike("email", trimmedEmail);
  }

  const { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error("Error finding existing customer:", error);
    return null;
  }
  
  return data as Customer | null;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: CustomerInsert & { phone?: string }) => {
      // Check for existing customer with same name and email
      const existing = await findExistingCustomer(
        customer.name,
        customer.email || undefined
      );
      
      if (existing) {
        // Return existing customer instead of creating duplicate
        return existing;
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      email,
    }: {
      id: string;
      name: string;
      email?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("customers")
        .update({ name, email })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
