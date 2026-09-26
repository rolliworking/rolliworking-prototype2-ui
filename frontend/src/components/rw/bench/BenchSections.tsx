import { AlertTriangle, Clock3, MessageSquare, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchBoard, BenchJobRow, BenchSplitRow, JobWithRefs, SplitState } from '@/api/client';
import { ClientRequestList } from '@/components/jobs/ClientRequests';
import { KindPill } from '@/components/jobs/JobBits';
import { PartLocations } from '@/components/rw/RwBits';
import { fmtDate } from '@/lib/format';

export const BenchSection = ({ title, count, testId, children, tone }: { title: string; count: number; testId: string; children: ReactNode; tone?: 'amber' | 'rose' }) => (
  <section data-testid={testId} className="space-y-2">
    <h2 className="flex items-baseline gap-2 text-lg font-bold text-slate-100">{title}<span data-testid={`${testId}-count`} className={`rounded-full px-2 py-0.5 font-mono text-xs ${tone === 'rose' ? 'bg-rose-500/20 text-rose-200' : tone === 'amber' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-slate-300'}`}>{count}</span></h2>
    {children}
  </section>
);

const Head = ({ j, onMessage, section }: { j: JobWithRefs; onMessage: (j: JobWithRefs) => void; section: string }) => (
  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xl font-semibold text-slate-100">{j.number}</span><span className="text-slate-300">{j.watch.brand} {j.watch.model}</span><span className="font-mono text-xs text-slate-500">{j.watch.reference}</span><KindPill kind={j.kind} />{j.priority === 'urgent' || j.priority === 'high' ? <span className="rounded-full bg-orange-500/20 px-2 text-xs text-orange-200">{j.priority}</span> : null}
    <button data-testid={`bench-msg-${section}-${j.id}`} onClick={() => onMessage(j)} className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm text-slate-200 hover:bg-white/10"><MessageSquare size={14} /> Message</button></div>
);

export const JobRowCard = ({ r, onMessage, showFlags, section }: { r: BenchJobRow; onMessage: (j: JobWithRefs) => void; showFlags?: boolean; section: string }) => (
  <article data-testid={`bench-${section}-${r.job.id}`} className={`rounded-2xl border p-4 ${r.stuck || r.late ? 'border-rose-500/40 bg-rose-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
    <Head j={r.job} onMessage={onMessage} section={section} />
    {(showFlags || r.stuck || r.late) && <div className="mt-2 flex flex-wrap gap-2 text-xs">{r.stuck && <span data-testid={`bench-flag-stuck-${r.job.id}`} className="inline-flex items-center gap-1 rounded-full bg-rose-500/25 px-2 py-0.5 text-rose-200"><AlertTriangle size={11} /> stuck · no scan movement {r.idleDays} working days</span>}{r.late && <span data-testid={`bench-flag-late-${r.job.id}`} className="inline-flex items-center gap-1 rounded-full bg-orange-500/25 px-2 py-0.5 text-orange-200"><Clock3 size={11} /> late · promised {fmtDate(r.job.dueAt!)}</span>}{!r.stuck && !r.late && <span className="text-slate-500">last movement {r.idleDays === 0 ? 'today' : `${r.idleDays} working day${r.idleDays === 1 ? '' : 's'} ago`}</span>}</div>}
    <div className="mt-3"><PartLocations parts={r.parts} /></div>
    <div className="mt-2"><ClientRequestList job={r.job} testId={`bench-client-requests-${r.job.id}`} /></div>
  </article>
);

const SPLIT_LABEL: Record<SplitState, string> = { split: 'Parts apart — working', waiting_band: 'Head in safe · waiting on band', waiting_head: 'Band in safe · waiting on head', reunited: 'Reunited at Final assembly' };
export const SplitCard = ({ s, onMessage }: { s: BenchSplitRow; onMessage: (j: JobWithRefs) => void }) => (
  <article data-testid={`bench-split-${s.job.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <Head j={s.job} onMessage={onMessage} section="split" />
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span data-testid={`bench-split-state-${s.job.id}`} className={`rounded-full px-2 py-0.5 ${s.state === 'reunited' ? 'bg-emerald-500/25 text-emerald-200' : s.state === 'split' ? 'bg-sky-500/20 text-sky-200' : 'bg-amber-400/20 text-amber-200'}`}>{SPLIT_LABEL[s.state]}</span>{s.bandDoneBy && <span data-testid={`bench-split-band-${s.job.id}`} className="text-slate-400">band completed by <b className="text-slate-200">{s.bandDoneBy}</b>{s.bandDoneAt && ` · ${fmtDate(s.bandDoneAt)}`}</span>}</div>
    <div className="mt-3"><PartLocations parts={s.parts} /></div>
  </article>
);

export const OutsourcedList = ({ rows, onMessage }: { rows: BenchBoard['outsourced']; onMessage: (j: JobWithRefs) => void }) => (
  <ul className="space-y-2">{rows.map((o) => <li key={o.job.id} data-testid={`bench-out-${o.job.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Head j={o.job} onMessage={onMessage} section="out" /><div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><span className="inline-flex items-center gap-1.5 text-slate-200"><Truck size={14} className="text-violet-300" /> {o.vendor}</span><span data-testid={`bench-out-days-${o.job.id}`} className={`rounded-full px-2 py-0.5 font-mono text-xs ${o.daysOut >= 7 ? 'bg-rose-500/25 text-rose-200' : 'bg-white/10 text-slate-300'}`}>{o.daysOut} day{o.daysOut === 1 ? '' : 's'} out</span><span className="text-xs text-slate-500">{o.reason}</span></div></li>)}</ul>
);

export const CompletedList = ({ rows }: { rows: BenchBoard['completed'] }) => (
  <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03]">{rows.map((c, i) => <li key={`${c.job.id}-${c.part.key}-${i}`} data-testid={`bench-done-${c.job.id}-${c.part.key}`} className="flex items-center gap-3 px-4 py-2.5 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: { head: '#2563eb', case: '#9333ea', band: '#16a34a' }[c.part.key] }} /><span className="font-mono text-slate-100">{c.job.number}</span><span className="text-slate-300">{c.part.label}</span><span className="text-slate-500">{c.job.watch.brand} {c.job.watch.model}</span><span className="ml-auto text-xs text-slate-500">{fmtDate(c.at)}</span></li>)}{!rows.length && <li className="px-4 py-3 text-sm text-slate-500">Nothing completed on the live board yet this month — the goal count includes work booked before this snapshot.</li>}</ul>
);
