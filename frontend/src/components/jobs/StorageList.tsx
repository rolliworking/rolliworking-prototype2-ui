import { Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import { StorageChip } from '@/components/jobs/StorageChip';
import { WbpJobCell } from '@/components/shared/WbpDots';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

// Jobs → filter "In storage" (MH 2026-10-02): the long-term storage list — not a lane, nothing here is on a board; scan out returns a job to active
export const StorageList = ({ jobs }: { jobs: JobWithRefs[] }) => {
  const navigate = useNavigate();
  const rows = [...jobs].sort((a, b) => (a.storage?.since ?? '').localeCompare(b.storage?.since ?? ''));
  return <Card bodyClassName="p-0" testId="storage-list-card" title={<span className="inline-flex items-center gap-2"><Archive size={13} className="text-indigo-700" /> In storage <span className="font-mono text-[11px] text-ink-400">{rows.length}</span></span>} subtitle="Finished, unpaid, moved into the long-term storage safe by scan · any scan out (station or Pickup Station) returns the job to active">
    <Table testId="storage-table">
      <thead><tr><Th>Job</Th><Th>Client</Th><Th>Watch</Th><Th>W · B · P</Th><Th>Since</Th><Th className="text-right">Balance due</Th><Th>Custody</Th><Th>Notice</Th></tr></thead>
      <tbody>{rows.map((j) => { const chip = api.storageChipSync(j); return <tr key={j.id} data-testid={`storage-row-${j.id}`} tabIndex={0} onClick={() => navigate(`/jobs/${j.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/jobs/${j.id}`)} className="cursor-pointer transition-colors hover:bg-canvas/70 focus:bg-canvas focus:outline-none">
        <Td className="font-mono text-xs font-medium text-ink">{j.number}</Td>
        <Td className="text-ink-700">{fullName(j.client)}</Td>
        <Td className="text-ink-700">{j.watch.brand} {j.watch.model}</Td>
        <Td><WbpJobCell jobId={j.id} workflow={j.workflow} /></Td>
        <Td><StorageChip job={j} testId={`storage-row-chip-${j.id}`} dense />{chip && <span className="ml-1 text-[11px] text-ink-500">{chip.days}d</span>}</Td>
        <Td className="tabular text-right font-medium text-rose-700">{chip?.balance ? fmtMoneyCents(chip.balance) : '—'}</Td>
        <Td className="text-xs text-ink-600">Long-term storage · VC</Td>
        <Td className="text-xs text-ink-500">{j.storage?.noticeEmailId ? `queued · ${fmtDate(j.storage.since)}` : j.storage ? `seeded · ${fmtDate(j.storage.since)}` : '—'}</Td>
      </tr>; })}{rows.length === 0 && <EmptyRow colSpan={8} text="Nothing in long-term storage." />}</tbody>
    </Table>
  </Card>;
};
