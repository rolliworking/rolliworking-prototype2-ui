import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Job } from '@/types/database';

interface SearchResult {
  type: 'job' | 'customer' | 'watch';
  id: string;
  title: string;
  subtitle: string;
  job?: Job;
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: async (): Promise<SearchResult[]> => {
      if (query.length < 2) return [];

      const results: SearchResult[] = [];

      // Search jobs by job_id or estimate_number
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          watch:watches(*)
        `)
        .or(`job_id.ilike.%${query}%,estimate_number.ilike.%${query}%`)
        .limit(5);

      if (jobs) {
        jobs.forEach((job) => {
          results.push({
            type: 'job',
            id: job.id,
            title: `Job ${job.job_id}`,
            subtitle: `${job.customer?.first_name} ${job.customer?.last_name} - ${job.watch?.brand} ${job.watch?.model || ''}`,
            job: job as Job,
          });
        });
      }

      // Search customers
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

      if (customers) {
        customers.forEach((customer) => {
          results.push({
            type: 'customer',
            id: customer.id,
            title: `${customer.first_name} ${customer.last_name}`,
            subtitle: customer.email || customer.phone || 'No contact info',
          });
        });
      }

      // Search watches by serial number
      const { data: watches } = await supabase
        .from('watches')
        .select(`
          *,
          customer:customers(*)
        `)
        .or(`serial_number.ilike.%${query}%,reference_number.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(5);

      if (watches) {
        watches.forEach((watch: any) => {
          results.push({
            type: 'watch',
            id: watch.id,
            title: `${watch.brand} ${watch.model || ''}`,
            subtitle: watch.serial_number 
              ? `S/N: ${watch.serial_number}` 
              : watch.reference_number 
                ? `Ref: ${watch.reference_number}`
                : `Owner: ${watch.customer?.first_name} ${watch.customer?.last_name}`,
          });
        });
      }

      return results;
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30, // Cache for 30 seconds
  });
}

// Search jobs by watch serial to find service history
export function useWatchServiceHistory(serialNumber: string) {
  return useQuery({
    queryKey: ['watch-history', serialNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          watch:watches!inner(*)
        `)
        .ilike('watches.serial_number', `%${serialNumber}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Job[];
    },
    enabled: serialNumber.length >= 3,
  });
}
