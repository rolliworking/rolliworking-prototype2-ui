import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimingTest, PressureTest, TimingTestFormData, PressureTestFormData } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// Timing Tests
export function useTimingTests(jobId: string) {
  return useQuery({
    queryKey: ['timing_tests', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timing_tests')
        .select('*')
        .eq('job_id', jobId)
        .order('test_date', { ascending: false });

      if (error) throw error;
      return data as TimingTest[];
    },
    enabled: !!jobId,
  });
}

export function useCreateTimingTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      testData,
    }: {
      jobId: string;
      testData: TimingTestFormData;
    }) => {
      const { data, error } = await supabase
        .from('timing_tests')
        .insert({
          job_id: jobId,
          ...testData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timing_tests', variables.jobId] });
      toast({
        title: 'Timing Test Recorded',
        description: 'The timing test results have been saved.',
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

export function useDeleteTimingTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ testId, jobId }: { testId: string; jobId: string }) => {
      const { error } = await supabase
        .from('timing_tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timing_tests', variables.jobId] });
      toast({
        title: 'Test Deleted',
        description: 'The timing test record has been removed.',
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

// Pressure Tests
export function usePressureTests(jobId: string) {
  return useQuery({
    queryKey: ['pressure_tests', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pressure_tests')
        .select('*')
        .eq('job_id', jobId)
        .order('test_date', { ascending: false });

      if (error) throw error;
      return data as PressureTest[];
    },
    enabled: !!jobId,
  });
}

export function useCreatePressureTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      testData,
    }: {
      jobId: string;
      testData: PressureTestFormData;
    }) => {
      const { data, error } = await supabase
        .from('pressure_tests')
        .insert({
          job_id: jobId,
          ...testData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pressure_tests', variables.jobId] });
      toast({
        title: 'Pressure Test Recorded',
        description: 'The pressure test results have been saved.',
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

export function useDeletePressureTest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ testId, jobId }: { testId: string; jobId: string }) => {
      const { error } = await supabase
        .from('pressure_tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pressure_tests', variables.jobId] });
      toast({
        title: 'Test Deleted',
        description: 'The pressure test record has been removed.',
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

// Get latest tests for a job
export function useLatestTests(jobId: string) {
  const { data: timingTests } = useTimingTests(jobId);
  const { data: pressureTests } = usePressureTests(jobId);

  const latestTiming = timingTests?.[0] || null;
  const latestPressure = pressureTests?.[0] || null;
  const isPressureTestPassed = latestPressure?.result_passed || false;

  return {
    latestTiming,
    latestPressure,
    isPressureTestPassed,
    hasTimingTests: (timingTests?.length || 0) > 0,
    hasPressureTests: (pressureTests?.length || 0) > 0,
  };
}
