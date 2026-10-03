import clsx from 'clsx';
import { AlertTriangle, History, PackageCheck, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import * as cu from '@/api/custody';
import type { ComponentKey } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtTime } from '@/lib/format';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
export const useCustodyTick = () => { const [, set] = useState(0); useEffect(() => { const h = () => set((n) => n + 1); window.addEventListener(cu.CUSTODY_EVENT, h); return () => window.removeEventListener(cu.CUSTODY_EVENT, h); }, []); };
const stationLabel = (k: string) => api.custodyBridge.stations().find((s) => s.key === k)?.label ?? k;
const guessNode = (): string => { const n = api.custodyBridge.actor().station ?? ''; return /front desk/i.test(n) ? 'finished' : /watchmaker/i.test(n) ? 'wm_bench_1' : /inspection/i.test(n) ? 'pre_approval' : 'finished'; };

// The one-tap fix: "Add to custody" = pick the node you are at + SCAN the item label (no scan, no custody) + why → source = backfill
export const BackfillModal = ({ jobId, part, onClose, onDone }: { jobId: string; part: ComponentKey; onClose: () => void; onDone: () => void }) => {
  const [node, setNode] = useState(guessNode()); const [label, setLabel] = useState(''); const [why, setWhy] = useState('Found during counter check — custody backfilled'); const [err, setErr] = useState<string | null>(null);
  const job = api.custodyBridge.allJobs().find((j) => j.id === jobId);
  const go = () => cu.backfillCustody(jobId, part, node, label, why).then(() => { onDone(); onClose(); }).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));
  return <Modal onClose={onClose} testId="custody-backfill-modal" title={`Add to custody · ${job?.number ?? ''} · ${api.custodyBridge.partLabel(part)}`}>
    <div className="space-y-3 text-xs">
      <p className="text-ink-600">Custody is written by a physical scan only. Pick the node you are standing at, scan the item's label, say why — this creates a <b>backfill</b> custody event (who / when / why) and clears the −1.</p>
      <label className="block text-ink-500">Node you are at<select data-testid="custody-backfill-node" value={node} onChange={(e) => setNode(e.target.value)} className={`${field} mt-1 block w-full`}>{api.custodyBridge.stations().map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      <label className="block text-ink-500">Scan the item label<input data-testid="custody-backfill-scan" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && label.trim() && go()} placeholder={job ? `${job.number}${part === 'band' ? '|B' : ''}` : 'E0xxxx'} className={`${field} mt-1 block w-full font-mono`} /></label>
      <label className="block text-ink-500">Why<input data-testid="custody-backfill-why" value={why} onChange={(e) => setWhy(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      {err && <div data-testid="custody-backfill-error" className="rounded-sm bg-rose-50 px-2 py-1 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="custody-backfill-confirm" disabled={!label.trim() || !why.trim()} onClick={go}><ScanLine size={12} /> Add to custody</Button></div>
    </div>
  </Modal>;
};

// Reads custody_current for one item. On hand → quiet chip. No real event → red "−1 client asset" + grey legacy hint + the one-tap fix.
export const CustodyChip = ({ jobId, part, onFixed, compact }: { jobId: string; part: ComponentKey; onFixed?: () => void; compact?: boolean }) => {
  useCustodyTick(); const [fix, setFix] = useState(false);
  const cur = cu.custodyCurrentByIdSync(jobId, part); if (!cur) return null; const id = `custody-chip-${jobId}-${part}`;
  if (cur.onHand) return <span data-testid={id} data-state="on_hand" className="inline-flex items-center gap-1 rounded-sm bg-moss-50 px-1.5 py-0.5 text-[11px] text-moss-800 ring-1 ring-moss-200"><PackageCheck size={11} /> {compact ? '' : 'On hand · '}{cur.event!.nodeLabel}{cur.event!.binLabel ? ` · ${cur.event!.binLabel}` : ''} <span className="text-moss-700/70">· {cur.event!.source} · {fmtDate(cur.event!.at)}</span></span>;
  return <>
    <span data-testid={id} data-state="minus_one" className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-sm bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"><AlertTriangle size={11} /> Not on hand · −1 client asset</span>
      {cur.legacy && <span data-testid={`${id}-legacy`} className="inline-flex items-center gap-1 rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500"><History size={10} /> last seen (legacy): {cur.legacy.label}</span>}
      <button type="button" data-testid={`${id}-fix`} onClick={() => setFix(true)} className="rounded-sm border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-100">Add to custody</button>
    </span>
    {fix && <BackfillModal jobId={jobId} part={part} onClose={() => setFix(false)} onDone={() => onFixed?.()} />}
  </>;
};

// Job page card: every component's custody_current + the real ledger for this job (audit / backfill / scan)
export const JobCustodyCard = ({ job, onChange }: { job: JobWithRefs; onChange?: () => void }) => {
  useCustodyTick(); const parts = api.custodyBridge.parts(api.custodyBridge.allJobs().find((j) => j.id === job.id)!); const events = cu.getCustodyEventsSync({ jobId: job.id }).slice(0, 6); const minus = cu.minusOneSync(job.id);
  return <div data-testid="job-custody-card" data-minus={minus.length} className={clsx('rounded-md bg-surface p-4 shadow-card', minus.length && 'ring-1 ring-rose-300')}>
    <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-ink">Custody · real scans only</div><div className="text-xs text-ink-500">custody_current per component · legacy position is a hint, never a node · {minus.length ? <span className="font-semibold text-rose-700">{minus.length} not on hand (−{minus.length})</span> : 'all on hand'}</div></div><Link to="/setup/custody" data-testid="job-custody-audit-link" className="text-xs text-brand hover:underline">Custody audit →</Link></div>
    <ul className="mt-2 space-y-1.5 text-xs">{parts.map((p) => <li key={p.key} data-testid={`job-custody-part-${p.key}`} className="flex flex-wrap items-center gap-2"><span className="w-20 font-medium text-ink">{api.custodyBridge.partLabel(p.key)}</span><CustodyChip jobId={job.id} part={p.key} onFixed={onChange} /></li>)}</ul>
    {events.length > 0 && <ul data-testid="job-custody-events" className="mt-2 space-y-0.5 border-t border-line pt-2 text-[11px] text-ink-500">{events.map((e) => <li key={e.id} data-testid={`job-custody-event-${e.id}`}>{fmtDate(e.at)} {fmtTime(e.at)} · <span className="font-medium text-ink-700">{api.custodyBridge.partLabel(e.part!)}</span> → {e.nodeLabel}{e.binLabel ? ` · ${e.binLabel}` : ''} · <span className="uppercase">{e.source}</span> · {e.by}{e.why ? ` · ${e.why}` : ''}</li>)}</ul>}
  </div>;
};
export const jobNodeLabel = stationLabel;
