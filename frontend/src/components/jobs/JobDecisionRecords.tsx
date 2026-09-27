import { FileCheck2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { InspectionDecisionRecord } from '@/api/client';
import { fmtDate, fmtTime } from '@/lib/format';

// Staff view of the client's permanent decision record (same document the client sees in Watch Records)
export const JobDecisionRecords = ({ jobId }: { jobId: string }) => {
  const [rows, setRows] = useState<InspectionDecisionRecord[]>([]);
  useEffect(() => { void api.getInspectionDecisions({ jobId }).then(setRows); }, [jobId]);
  if (!rows.length) return null;
  return <ul data-testid="job-decision-records" className="space-y-1.5">{rows.map((d) => <li key={d.id} data-testid={`job-decision-${d.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-moss-200 bg-moss-50/50 px-3 py-2 text-xs"><FileCheck2 size={13} className="text-moss-700" /><span className="font-semibold text-ink">Client decisions · {fmtDate(d.decidedAt)} {fmtTime(d.decidedAt)}</span><span>{d.decision === 'approve' ? 'Approved' : `Declined${d.reason ? ` — “${d.reason}”` : ''}`}</span><span className="text-ink-500">· polish {d.polish}</span>{d.survey.map((s) => <span key={s.q} className="text-ink-500">· {s.q.replace(/\?$/, '')}: {s.a}</span>)}<span className="ml-auto font-serif italic text-ink-600">signed {d.signature} · report v{d.reportVersion}</span></li>)}</ul>;
};
