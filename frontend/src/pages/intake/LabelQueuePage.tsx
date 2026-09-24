import clsx from 'clsx';
import { Printer, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as api from '@/api/client';
import type { LabelJob } from '@/api/client';
import { Button, FilterChip } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';
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

const LabelCard = ({ l, onToggle }: { l: LabelJob; onToggle: () => void }) => (
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
      <Button size="sm" data-testid={`label-${l.id}-toggle`} onClick={onToggle}>
        {l.printed ? <><RotateCcw size={12} /> Mark unprinted</> : <><Printer size={12} /> Print (mock)</>}
      </Button>
    </div>
  </div>
);

export default function LabelQueuePage() {
  const { data, reload } = useAsync(() => api.getLabelQueue());
  const [filter, setFilter] = useState<'unprinted' | 'all'>('unprinted');
  const rows = useMemo(() => (data ?? []).filter((l) => filter === 'all' || !l.printed), [data, filter]);
  const unprinted = (data ?? []).filter((l) => !l.printed).length;

  const toggle = async (l: LabelJob) => {
    await api.setLabelPrinted(l.id, !l.printed);
    reload();
  };

  return (
    <div data-testid="label-queue-page">
      <div className="mb-3 flex items-center gap-1.5">
        <FilterChip active={filter === 'unprinted'} onClick={() => setFilter('unprinted')} testId="labels-filter-unprinted">Unprinted <span className="ml-1 opacity-60">{unprinted}</span></FilterChip>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} testId="labels-filter-all">All <span className="ml-1 opacity-60">{data?.length ?? 0}</span></FilterChip>
        <span className="ml-auto text-xs text-ink-400">Two labels queue per received watch · mock render, no printer</span>
      </div>
      {rows.length === 0 && data ? (
        <Card><p className="py-6 text-center text-xs text-ink-400" data-testid="labels-empty">Nothing to print.</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="label-grid">
          {rows.map((l) => <LabelCard key={l.id} l={l} onToggle={() => toggle(l)} />)}
        </div>
      )}
    </div>
  );
}
