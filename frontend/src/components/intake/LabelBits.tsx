import clsx from 'clsx';
import { Printer, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { LabelJob } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

// Deterministic pseudo-barcode from the payload — a mock render, not a real encoder
const bars = (payload: string, count: number) => {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= payload.charCodeAt(i % payload.length);
    h = Math.imul(h, 16777619) >>> 0;
    out.push(1 + (h % 3));
  }
  return out;
};

const Pdf417 = ({ payload }: { payload: string }) => (
  <div className="flex flex-col gap-[2px] rounded-sm bg-white p-1.5" aria-label="PDF417 mock">
    {Array.from({ length: 6 }).map((_, row) => (
      <div key={row} className="flex h-[5px] gap-[1px]">
        {bars(payload + row, 34).map((w, i) => (
          <span key={i} className={clsx('h-full', i % 2 === 0 ? 'bg-ink' : 'bg-transparent')} style={{ width: w * 2 }} />
        ))}
      </div>
    ))}
  </div>
);

const Linear = ({ payload }: { payload: string }) => (
  <div className="flex h-8 items-stretch gap-[1px] rounded-sm bg-white px-1.5 py-1" aria-label="Barcode mock">
    {bars(payload, 40).map((w, i) => (
      <span key={i} className={clsx(i % 2 === 0 ? 'bg-ink' : 'bg-transparent')} style={{ width: w * 1.5 }} />
    ))}
  </div>
);

export const LabelCard = ({ l, onToggle, hideActions = false }: { l: LabelJob; onToggle: () => void; hideActions?: boolean }) => (
  <div data-testid={`label-${l.id}`} data-printed={l.printed} className={clsx('rounded-md bg-surface p-3 shadow-card transition-opacity', l.printed && 'opacity-70')}>
    <div className="mb-2 flex items-center justify-between text-[11px]">
      <span className="font-semibold uppercase tracking-wide text-ink-500">{l.type === 'pdf417_data' ? 'PDF417 data label' : 'Ref · serial watch label'}</span>
      <span data-testid={`label-${l.id}-state`} className={clsx('rounded-sm px-1.5 py-0.5 font-semibold uppercase tracking-wide', l.printed ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800')}>{l.printed ? 'printed' : 'unprinted'}</span>
    </div>
    <div className="rounded-sm border border-dashed border-ink-300 bg-canvas p-3">
      <div className={clsx('grid gap-3', l.type === 'pdf417_data' ? 'grid-cols-[1fr_auto]' : 'grid-cols-1')}>
        <div className="font-mono text-[11px] leading-4 text-ink">
          {l.lines.map((ln, i) => <div key={i} className={i === 0 ? 'text-[13px] font-semibold' : ''}>{ln}</div>)}
        </div>
        {l.type === 'pdf417_data' ? <Pdf417 payload={l.payload} /> : <Linear payload={l.payload} />}
      </div>
      <div className="mt-2 truncate font-mono text-[10px] text-ink-400" title={l.payload}>{l.payload}</div>
    </div>
    <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
      <span>{l.estimateNumber} · {l.createdBy} · {l.station} · {fmtDate(l.createdAt)} {fmtTime(l.createdAt)}</span>
      {!hideActions && <Button size="sm" data-testid={`label-${l.id}-toggle`} onClick={onToggle}>
        {l.printed ? <><RotateCcw size={12} /> Mark unprinted</> : <><Printer size={12} /> Print (mock)</>}
      </Button>}
    </div>
  </div>
);


const PRINTERS = ['Zebra ZD421 — Front Desk 1', 'Zebra ZD421 — Front Desk 2', 'Brother QL-820 — Workshop'];
// Label print dialog — the end of the Receive Watch flow (Save & Print) and the reprint path from the Label Queue. Mock printer: marks the jobs printed.
export const LabelPrintDialog = ({ labels, title, onClose, onPrinted }: { labels: LabelJob[]; title?: string; onClose: () => void; onPrinted: (ids: string[]) => void }) => {
  const [printer, setPrinter] = useState(PRINTERS[0]); const [copies, setCopies] = useState(1); const [sel, setSel] = useState<string[]>(labels.map((l) => l.id)); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const print = async () => { setBusy(true); try { await Promise.all(sel.map((id) => api.setLabelPrinted(id, true))); setDone(true); onPrinted(sel); } finally { setBusy(false); } };
  return <div data-testid="label-print-dialog" className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
    <div className="w-[720px] max-h-[90vh] overflow-y-auto rounded-md bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-semibold text-ink">{title ?? 'Print component labels'}</div><div className="text-xs text-ink-500">{labels.length} label{labels.length === 1 ? '' : 's'} · PDF417 data label + Ref·serial watch label · mock printer, no real spool</div></div><button data-testid="label-print-close" onClick={onClose} className="text-ink-400 hover:text-ink"><X size={16} /></button></div>
      <div className="grid grid-cols-2 gap-3">{labels.map((l) => <label key={l.id} className={clsx('block rounded-md border', sel.includes(l.id) ? 'border-ink' : 'border-line opacity-70')}><div className="flex items-center gap-2 px-3 pt-2 text-xs"><input type="checkbox" data-testid={`label-print-select-${l.id}`} checked={sel.includes(l.id)} onChange={(e) => setSel((v) => (e.target.checked ? [...v, l.id] : v.filter((x) => x !== l.id)))} /> include</div><LabelCard l={l} onToggle={() => undefined} hideActions /></label>)}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><label>Printer<select data-testid="label-print-printer" value={printer} onChange={(e) => setPrinter(e.target.value)} className="ml-2 h-8 rounded-sm border border-line bg-canvas px-2 text-xs">{PRINTERS.map((p) => <option key={p}>{p}</option>)}</select></label><label>Copies<input type="number" min={1} max={5} data-testid="label-print-copies" value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(5, Number(e.target.value))))} className="ml-2 h-8 w-14 rounded-sm border border-line bg-canvas px-2 text-xs" /></label>
        <span className="ml-auto flex gap-2">{done ? <><span data-testid="label-print-done" className="inline-flex items-center rounded-sm bg-moss-50 px-2 py-1 font-semibold text-moss-700">Sent to {printer} · {sel.length * copies} label{sel.length * copies === 1 ? '' : 's'}</span><Button variant="primary" data-testid="label-print-finish" onClick={onClose}>Done</Button></> : <><Button data-testid="label-print-cancel" onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="label-print-confirm" disabled={!sel.length || busy} onClick={() => void print()}><Printer size={13} /> {busy ? 'Printing…' : `Print ${sel.length * copies} label${sel.length * copies === 1 ? '' : 's'}`}</Button></>}</span></div>
    </div>
  </div>;
};
