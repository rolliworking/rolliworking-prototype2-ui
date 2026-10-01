import { Archive, ChevronDown, ChevronRight, Lock, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { CustodyByPerson, CustodyItem } from '@/api/client';
import { PART_NAME, PartDot } from '@/components/rw/RwBits';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime } from '@/lib/format';

// Component code for the tag: which department this physical part belongs to (matches W / B / P / PM chips used on estimates)
const partDept = (it: CustodyItem): string => (it.key === 'band' ? 'B' : it.key === 'case' ? (it.workflow.includes('PM') ? 'PM' : 'P') : 'W');

// Thin row: Est# · client last name · model · dept tag. Everything else only on expand.
const Row = ({ it }: { it: CustodyItem }) => {
  const [open, setOpen] = useState(false);
  return <li data-testid={`custody-item-${it.jobId}-${it.key}`} className="rounded-sm border border-line bg-surface">
    <button type="button" data-testid={`custody-row-${it.jobId}-${it.key}`} aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-8 w-full items-center gap-3 px-2.5 text-left text-[13px] hover:bg-canvas">
      {open ? <ChevronDown size={12} className="shrink-0 text-ink-400" /> : <ChevronRight size={12} className="shrink-0 text-ink-400" />}
      <span className="w-16 font-mono font-semibold text-ink">{it.estimateNumber ?? it.jobNumber}</span>
      <span className="w-28 truncate text-ink">{it.clientLastName}</span>
      <span className="flex-1 truncate text-ink-700">{it.watchLabel}</span>
      <DeptBadge code={partDept(it)} />
    </button>
    {open && <div data-testid={`custody-detail-${it.jobId}-${it.key}`} className="grid gap-x-6 gap-y-1 border-t border-line bg-canvas px-2.5 py-2 text-xs text-ink-700 md:grid-cols-[auto_1fr]">
      <span className="text-ink-500">Part</span><span className="inline-flex items-center gap-1.5"><PartDot k={it.key} size={9} /> {PART_NAME[it.key]}{it.itemLabel && <span className="rounded-sm bg-surface px-1 font-mono text-[11px] ring-1 ring-line">{it.itemLabel}</span>}</span>
      <span className="text-ink-500">Where</span><span>{api.isSafeStation(it.station) && <Lock size={10} className="mr-1 inline text-amber-700" />}{it.stationLabel} · <span className="capitalize">{it.partStatus.replace(/_/g, ' ')}</span>{it.containerInfo && <span data-testid={`custody-in-bin-${it.jobId}-${it.key}`} className="ml-1 rounded-sm bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">in {it.containerInfo.label}</span>}{it.heldSince && <span className="text-ink-500"> · since {fmtDate(it.heldSince)} {fmtTime(it.heldSince)}</span>}</span>
      <span className="text-ink-500">Job</span><span className="inline-flex items-center gap-2"><Link to={`/jobs/${it.jobId}`} data-testid={`custody-open-${it.jobId}`} className="font-mono text-brand hover:underline">{it.jobNumber}</Link><StatusPill status={it.status} /><span className="inline-flex gap-0.5">{it.workflow.map((w) => <DeptBadge key={w} code={w} />)}</span>{it.priority !== 'normal' && <span className="capitalize text-ink-500">{it.priority}</span>}</span>
      {it.notes.length > 0 && <><span className="text-ink-500">Notes</span><ul className="space-y-0.5">{it.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></>}
    </div>}
  </li>;
};

// Person section — collapsed by default: name + count only. Header toggles the row list. Items riding in a container (JV bin) sit under their own sub-header.
const Person = ({ g }: { g: CustodyByPerson }) => {
  const [open, setOpen] = useState(false);
  const binned = g.items.filter((it) => it.containerInfo); const loose = g.items.filter((it) => !it.containerInfo); const bin = binned[0]?.containerInfo;
  return <section data-testid={`custody-person-${g.tech}`} data-open={open} className="rounded-md border border-line bg-surface">
    <button type="button" data-testid={`custody-toggle-${g.tech}`} aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-canvas">
      {open ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" />}<UserRound size={15} className="text-ink-400" />
      <h2 className="text-base font-semibold text-ink">{g.name}</h2>
      <span data-testid={`custody-count-${g.tech}`} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-600 ring-1 ring-line">{g.items.length}</span>
      {bin && <span data-testid={`custody-bin-chip-${g.tech}`} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200"><Archive size={11} /> {bin.label} · {binned.length}</span>}
    </button>
    {open && <div data-testid={`custody-list-${g.tech}`} className="space-y-2 border-t border-line bg-canvas/40 p-2">
      {bin && <div data-testid={`custody-bin-${g.tech}`} className="rounded-sm border border-amber-200 bg-amber-50/40 p-1.5">
        <div data-testid={`custody-bin-header-${g.tech}`} className="mb-1 flex items-center gap-2 px-1 text-xs font-semibold text-amber-900"><Archive size={12} /> {bin.label} · {bin.holderLabel} <span className="font-normal text-amber-700">· {binned.length} inside · the bin holds custody</span></div>
        <ul className="space-y-1">{binned.map((it) => <Row key={`${it.jobId}-${it.key}`} it={it} />)}</ul>
      </div>}
      {loose.length > 0 && <ul className="space-y-1">{bin && <li className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">In hand / at a station</li>}{loose.map((it) => <Row key={`${it.jobId}-${it.key}`} it={it} />)}</ul>}
    </div>}
  </section>;
};

export default function CustodyPage() {
  const { data } = useAsync(() => api.getCustodyByPerson());
  if (!data) return null;
  return <div data-testid="custody-page" className="space-y-4">
    <div><h1 className="text-xl font-semibold tracking-tight text-ink">Custody</h1><p className="mt-0.5 text-xs text-ink-500">Who physically holds what right now — every watch head, case and bracelet logged to a person, same data as the Shop Floor board and the custody log. Counts are scannable closed; click a name to open their list, a row for detail.</p></div>
    <div data-testid="custody-grid" className="grid items-start gap-3 md:grid-cols-2">{data.map((g) => <Person key={g.tech} g={g} />)}</div>
    {!data.length && <p className="text-sm text-ink-500">Nobody is holding anything right now.</p>}
  </div>;
}
