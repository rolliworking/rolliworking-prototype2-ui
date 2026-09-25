import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { CycleCount, StockLocation, StockMovement, StockRow } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, Head, Tabs, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

interface Bundle { rows: StockRow[]; moves: StockMovement[]; counts: CycleCount[]; locations: StockLocation[] }
const load = async (): Promise<Bundle> => ({ rows: await api.getStockRows(), moves: await api.getStockMovements(), counts: await api.getCycleCounts(), locations: await api.getLocations() });

export default function InventoryPage() {
  const { data, error, msg, run } = useLoad(load);
  const [tab, setTab] = useState('stock');
  const [adjust, setAdjust] = useState<StockRow | null>(null);
  const [countLoc, setCountLoc] = useState('');
  const [counted, setCounted] = useState<Record<string, number>>({});
  if (!data) return <div className="text-xs text-ink-400">Loading…</div>;
  const low = data.rows.filter((r) => r.low);
  const openCount = data.counts.find((c) => c.status === 'open');
  const locName = (id: string) => data.locations.find((l) => l.id === id)?.name ?? id;
  const shown = tab === 'low' ? low : data.rows;
  return (
    <div data-testid="inventory-page" className="space-y-4">
      <Head title="Inventory" sub={<>Parts stock by location · movements · adjustments with reason · cycle counts <Provisional note="Cross-division stock visibility not ruled (MH) — all locations shown" /></>} />
      <Flash error={error} msg={msg} />
      <Tabs prefix="inv" active={tab} onChange={setTab} tabs={[{ key: 'stock', label: 'Stock', count: data.rows.length }, { key: 'low', label: 'Low stock', count: low.length }, { key: 'moves', label: 'Movements', count: data.moves.length }, { key: 'counts', label: 'Cycle counts', count: data.counts.length }]} />
      {(tab === 'stock' || tab === 'low') && <Card bodyClassName="p-0" testId="stock-table"><Table><thead><tr><Th>Part</Th><Th>Location</Th><Th className="text-right">On hand</Th><Th className="text-right">Reorder at</Th><Th>Flag</Th><Th /></tr></thead><tbody>
        {shown.map((r) => <tr key={`${r.part.id}-${r.location.id}`} data-testid={`stock-${r.part.id}-${r.location.id}`}><Td><span className="font-mono text-xs font-semibold">{r.part.partNumber}</span> <span className="text-xs text-ink-500">{r.part.name}</span></Td><Td className="text-xs">{r.location.name} <span className="text-[11px] capitalize text-ink-400">· {r.location.division}</span></Td><Td className={`tabular text-right text-xs ${r.onHand === 0 ? 'text-rose-700 font-semibold' : ''}`}>{r.onHand}</Td><Td className="tabular text-right text-xs text-ink-500">{r.reorderPoint}</Td><Td>{r.low && <span data-testid={`low-flag-${r.part.id}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">LOW</span>}</Td><Td className="text-right"><Button size="sm" variant="ghost" data-testid={`adjust-${r.part.id}-${r.location.id}`} onClick={() => setAdjust(r)}>Adjust</Button>{r.low && <Link data-testid={`create-po-${r.part.id}`} to={`/purchasing?part=${r.part.id}`} className="ml-1 text-xs text-brand underline-offset-2 hover:underline">Create PO →</Link>}</Td></tr>)}
        {!shown.length && <EmptyRow colSpan={6} text="Nothing here" />}
      </tbody></Table></Card>}
      {tab === 'moves' && <Card bodyClassName="p-0" testId="movements-table"><Table><thead><tr><Th>When</Th><Th>Kind</Th><Th>Part</Th><Th>Location</Th><Th className="text-right">Δ</Th><Th className="text-right">Before → after</Th><Th>Reason</Th><Th>By</Th></tr></thead><tbody>
        {data.moves.map((m) => <tr key={m.id} data-testid={`move-${m.id}`}><Td className="text-[11px] text-ink-500">{fmtDate(m.at)} {fmtTime(m.at)}</Td><Td><StatusPill status={m.kind} /></Td><Td className="font-mono text-xs">{api.partsById(m.partId)?.partNumber}</Td><Td className="text-xs">{locName(m.locationId)}</Td><Td className={`tabular text-right text-xs font-semibold ${m.delta < 0 ? 'text-rose-700' : 'text-moss-700'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</Td><Td className="tabular text-right text-xs text-ink-500">{m.before} → {m.after}</Td><Td className="text-xs">{m.reason}{m.ref && <span className="ml-1 font-mono text-[11px] text-ink-400">{m.ref}</span>}</Td><Td className="text-[11px] text-ink-500">{m.by} · {m.station}</Td></tr>)}
      </tbody></Table></Card>}
      {tab === 'counts' && <div className="grid grid-cols-[1fr_420px] gap-4">
        <Card title="Counts" bodyClassName="p-0" testId="counts-table"><Table><thead><tr><Th>Count</Th><Th>Location</Th><Th>Status</Th><Th className="text-right">Lines</Th><Th className="text-right">Variances</Th><Th>By</Th></tr></thead><tbody>
          {data.counts.map((c) => <tr key={c.id} data-testid={`count-${c.id}`}><Td className="font-mono text-xs font-semibold">{c.number}</Td><Td className="text-xs">{locName(c.locationId)}</Td><Td><StatusPill status={c.status === 'posted' ? 'complete' : 'open'} /></Td><Td className="tabular text-right text-xs">{c.lines.length}</Td><Td className={`tabular text-right text-xs ${c.variances ? 'text-amber-800 font-semibold' : ''}`}>{c.variances}</Td><Td className="text-[11px] text-ink-500">{c.by} · {fmtDate(c.at)}</Td></tr>)}
          {!data.counts.length && <EmptyRow colSpan={6} text="No counts yet" />}
        </tbody></Table></Card>
        <Card title={openCount ? `Counting ${openCount.number} · ${locName(openCount.locationId)}` : 'Start a cycle count'} subtitle={openCount ? 'Enter what you physically see; variances post as audited movements' : 'Pick a location'} testId="count-panel">
          {!openCount ? <div className="flex gap-2"><select data-testid="count-location" value={countLoc} onChange={(e) => setCountLoc(e.target.value)} className={`${field} flex-1`}><option value="">Location…</option>{data.locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.division}</option>)}</select><Button variant="primary" data-testid="count-start" disabled={!countLoc} onClick={() => run(() => api.startCycleCount(countLoc), 'Count started')}>Start</Button></div>
            : <div className="space-y-1">{openCount.lines.map((l) => { const c = counted[l.partId]; const d = c === undefined ? null : c - l.expected; return <div key={l.partId} className="flex items-center gap-2 text-xs"><span className="w-28 font-mono">{api.partsById(l.partId)?.partNumber}</span><span className="w-20 text-ink-500">expected {l.expected}</span><input data-testid={`count-input-${l.partId}`} type="number" min={0} value={c ?? ''} onChange={(e) => setCounted({ ...counted, [l.partId]: Number(e.target.value) })} className={`${field} w-16 text-right`} />{d !== null && d !== 0 && <span data-testid={`variance-${l.partId}`} className="rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800">{d > 0 ? '+' : ''}{d}</span>}</div>; })}
              <div className="pt-2 text-right"><Button variant="primary" data-testid="count-post" onClick={() => run(async () => { await api.postCycleCount(openCount.id, counted); setCounted({}); }, 'Count posted')}>Post count</Button></div></div>}
        </Card>
      </div>}
      {adjust && <AdjustModal row={adjust} onClose={() => setAdjust(null)} run={run} />}
    </div>
  );
}

function AdjustModal({ row, onClose, run }: { row: StockRow; onClose: () => void; run: (a: () => Promise<unknown>, m?: string) => Promise<void> }) {
  const [delta, setDelta] = useState(1); const [reason, setReason] = useState('');
  return <Modal testId="adjust-modal" title={`Adjust ${row.part.partNumber} @ ${row.location.name}`} onClose={onClose}>
    <div className="flex items-end gap-2 text-xs text-ink-500"><label>Δ quantity<input data-testid="adjust-delta" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className={`${field} mt-1 block w-24 text-right`} /></label><label className="flex-1">Reason (required)<input data-testid="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged, found in drawer, miscount" className={`${field} mt-1 block w-full`} /></label></div>
    <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="adjust-save" onClick={() => run(async () => { await api.adjustStock(row.part.id, row.location.id, delta, reason); onClose(); }, 'Stock adjusted')}>Post adjustment</Button></div>
  </Modal>;
}
