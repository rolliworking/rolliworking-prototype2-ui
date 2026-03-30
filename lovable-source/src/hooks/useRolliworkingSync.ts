import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ROLLIWORKING_INTAKE_URL = 'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1/rollisuite-intake';

interface IntakeData {
  fullName: string;
  email: string;
  phone: string;
  partNumber: string;
  date?: string;
  brand: string;
  model: string;
  estimateNumber: string;
}

/**
 * Send intake data to Rolliworking when a watch is received
 * Uses caret-delimited format: full_name^email^phone^part_number^date^brand^model^estimate_number
 */
export function useSendToRolliworking() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (intake: IntakeData) => {
      const date = intake.date || format(new Date(), 'yyyy-MM-dd');
      
      // Create caret-delimited payload
      const payload = [
        intake.fullName || '',
        intake.email || '',
        intake.phone || '',
        intake.partNumber || '',
        date,
        intake.brand || '',
        intake.model || '',
        intake.estimateNumber || '',
      ].join('^');

      console.log('[Rolliworking Sync] Sending intake:', payload);

      const response = await fetch(ROLLIWORKING_INTAKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Rolliworking sync failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      console.log('[Rolliworking Sync] Intake sent successfully');
    },
    onError: (error) => {
      console.error('[Rolliworking Sync] Failed to send intake:', error);
      // Don't show error toast - this is a background sync, shouldn't interrupt user flow
    },
  });
}

/**
 * Utility function for fire-and-forget sync (used in useConvertToIntakeNew)
 */
export async function sendIntakeToRolliworking(intake: IntakeData): Promise<void> {
  try {
    const date = intake.date || format(new Date(), 'yyyy-MM-dd');
    
    const payload = [
      intake.fullName || '',
      intake.email || '',
      intake.phone || '',
      intake.partNumber || '',
      date,
      intake.brand || '',
      intake.model || '',
      intake.estimateNumber || '',
    ].join('^');

    console.log('[Rolliworking Sync] Sending intake:', payload);

    const response = await fetch(ROLLIWORKING_INTAKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
    });

    if (!response.ok) {
      console.error('[Rolliworking Sync] Failed:', response.status);
    } else {
      console.log('[Rolliworking Sync] Intake sent successfully');
    }
  } catch (error) {
    console.error('[Rolliworking Sync] Error:', error);
    // Fire and forget - don't throw
  }
}
