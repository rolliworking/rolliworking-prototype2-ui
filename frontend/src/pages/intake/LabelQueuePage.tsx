import { useMemo, useState } from 'react';
import * as api from '@/api/client';
import type { LabelJob } from '@/api/client';
import { LabelCard, LabelPrintDialog } from '@/components/intake/LabelBits';
import { Button, FilterChip } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';

export default function LabelQueuePage() {
  const { data, reload } = useAsync(() => api.getLabelQueue());
  const [filter, setFilter] = useState<'unprinted' | 'all'>('unprinted'); const [dialog, setDialog] = useState(false);
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
        {unprinted > 0 && <Button size="sm" variant="primary" data-testid="labels-print-all" onClick={() => setDialog(true)}>Print all unprinted ({unprinted})</Button>}
      </div>
      {rows.length === 0 && data ? (
        <Card><p className="py-6 text-center text-xs text-ink-400" data-testid="labels-empty">Nothing to print.</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="label-grid">
          {rows.map((l) => <LabelCard key={l.id} l={l} onToggle={() => toggle(l)} />)}
        </div>
      )}
      {dialog && <LabelPrintDialog labels={(data ?? []).filter((l) => !l.printed)} title="Print queued labels" onClose={() => { setDialog(false); reload(); }} onPrinted={() => reload()} />}
    </div>
  );
}
