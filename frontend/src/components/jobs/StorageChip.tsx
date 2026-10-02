import { Archive } from 'lucide-react';
import * as api from '@/api/client';
import type { Job } from '@/api/client';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

// "In storage · since <date>" — the long-term storage chip (MH 2026-10-02). Shown wherever a job row or header renders; clears when any scan takes the job out.
export const StorageChip = ({ job, testId = 'storage-chip', dense }: { job: Job; testId?: string; dense?: boolean }) => {
  const s = api.storageChipSync(job);
  if (!s) return null;
  return <span data-testid={testId} data-since={s.since} title={`Long-term storage since ${fmtDate(s.since)} · ${s.days} day${s.days === 1 ? '' : 's'}${s.balance ? ` · balance due ${fmtMoneyCents(s.balance)}` : ''} · scan the ticket out at any station or start the pickup to return it`} className={`inline-flex items-center gap-1 rounded-sm border border-indigo-200 bg-indigo-50 font-semibold text-indigo-900 ${dense ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'}`}>
    <Archive size={dense ? 9 : 10} /> In storage · since {fmtDate(s.since)}{!dense && s.balance ? <span className="font-normal text-indigo-700">· {fmtMoneyCents(s.balance)} due</span> : null}
  </span>;
};
