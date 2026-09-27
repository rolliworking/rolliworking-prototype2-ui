import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { InspectionForm } from '@/api/client';
import { InspectionReportView } from '@/components/inspection/InspectionReportView';

// Client-facing inspection report — tokened URL, same pattern as the SO / estimate portal links. Read-only.
export default function RcInspectionFormPage() {
  const { token = '' } = useParams(); const [f, setF] = useState<InspectionForm | null | undefined>(undefined);
  useEffect(() => { api.getInspectionFormByToken(token).then(setF); }, [token]);
  if (f === undefined) return null;
  if (!f) return <div data-testid="rc-inspection-missing" className="mx-auto max-w-lg p-8 text-center text-sm text-ink-500">This inspection report link is not valid or has not been issued yet.</div>;
  return <div data-testid="rc-inspection-page" className="mx-auto max-w-3xl space-y-3 p-4 sm:p-8"><InspectionReportView f={f} testId="rc-inspection-report" /><div className="flex justify-end print:hidden"><button data-testid="rc-inspection-print" onClick={() => window.print()} className="rounded-md border border-line px-3 py-1.5 text-xs">Print / save PDF</button></div></div>;
}
