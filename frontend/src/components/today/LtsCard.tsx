import { Archive, Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { LtsBoard } from '@/api/client';
import { WbpJobDots } from '@/components/shared/WbpDots';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

// MH Hitlist card "Long-term storage" (2026-10-02): jobs with the invoice unpaid past the Setup threshold — job · client · balance · days unpaid · custody.
// Pinned (not dismissible); rows clear as jobs are scanned into the LTS safe. Nothing moves from here — the move is the scan (Assign / Move → Long-term storage).
export const LtsCard = ({ onEmpty }: { onEmpty?: boolean }) => {
  const [board, setBoard] = useState<LtsBoard | null>(null);
  useEffect(() => { void api.getLtsBoard().then(setBoard); }, []);
  if (!board || (board.count === 0 && !onEmpty)) return null;
  return <Card testId="lts-card" bodyClassName="p-0" className="border-l-[3px] border-indigo-400"
    title={<span className="inline-flex items-center gap-2"><Pin size={12} className="text-amber-700" /><Archive size={13} className="text-indigo-700" /> Long-term storage <span data-testid="lts-card-count" className="font-mono text-[11px] text-ink-500">{board.count}</span><span data-testid="lts-card-total" className="rounded-sm bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-900">{fmtMoneyCents(board.totalBalance)} unpaid</span></span>}
    subtitle={`Finished · invoice unpaid > ${board.thresholdDays} days · move by scan only (Assign / Move → Long-term storage) · clears as jobs are moved${board.stored.length ? ` · ${board.stored.length} already in storage` : ''}`}>
    {board.count === 0 ? <p data-testid="lts-card-empty" className="px-4 py-3 text-xs text-ink-400">Nothing waiting — every unpaid finished job is under {board.thresholdDays} days or already in storage.</p>
      : <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-4 py-1.5">Job</th><th className="py-1.5">Client</th><th className="py-1.5 text-right">Balance</th><th className="py-1.5 text-right">Days unpaid</th><th className="py-1.5 pr-4">Current custody</th></tr></thead>
        <tbody data-testid="lts-card-rows">{board.rows.map((r) => <tr key={r.jobId} data-testid={`lts-row-${r.jobId}`} className="border-t border-line/70 hover:bg-canvas/70">
          <td className="px-4 py-1.5"><Link to={`/jobs/${r.jobId}`} data-testid={`lts-row-job-${r.jobId}`} className="font-mono font-semibold text-ink hover:underline">{r.jobNumber}</Link><span className="ml-1.5 text-ink-500">{r.watchLabel}</span><span className="ml-1.5"><WbpJobDots jobId={r.jobId} /></span></td>
          <td className="py-1.5"><Link to={`/clients/${r.clientId}`} className="hover:underline">{r.clientName}</Link></td>
          <td className="py-1.5 text-right font-mono font-semibold text-rose-700"><Link to={`/sales/${r.soId}`} title={`${r.soNumber} · invoice sent ${fmtDate(r.invoiceSentAt)}`} className="hover:underline">{fmtMoneyCents(r.balanceDue)}</Link></td>
          <td data-testid={`lts-row-days-${r.jobId}`} className="py-1.5 text-right font-mono tabular-nums text-ink-700">{r.daysUnpaid}d</td>
          <td className="py-1.5 pr-4 text-ink-600">{r.custody}</td>
        </tr>)}</tbody></table>}
    <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-500"><span>Scan the ticket (or BIN-JV) with the Long-term storage safe armed — status becomes In storage, the client gets the notice.</span><Link to="/assign" data-testid="lts-card-open-assign" className="font-medium text-brand hover:underline">Assign / Move →</Link></div>
  </Card>;
};
