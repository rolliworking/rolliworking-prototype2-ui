import clsx from 'clsx';
import { ArrowLeft, Lock, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import * as sf from '@/api/safes';
import type { ContainerKind, LocationNode, SafeContainer } from '@/api/safes';
import { field } from '@/components/rs/RsBits';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtMoney } from '@/lib/format';

// Setup → Containers (owner): safe-class containers carry insuranceLimit + policyRef; bins / shelves have no limit; every tray / station / shelf-bin node is parented here (D-396) — the Safes card sums by parent
type Draft = { key?: string; label: string; kind: ContainerKind; limit: string; policyRef: string; parent: string; scanNode: string };
const blank = (): Draft => ({ label: '', kind: 'safe', limit: '', policyRef: '', parent: '', scanNode: '' });
const fromC = (c: SafeContainer): Draft => ({ key: c.key, label: c.label, kind: c.kind, limit: c.insuranceLimit !== undefined ? String(c.insuranceLimit) : '', policyRef: c.policyRef ?? '', parent: c.parent ?? '', scanNode: c.scanNode ?? '' });
const GROUP_LABEL: Record<LocationNode['group'], string> = { tray: 'Safe trays (scan nodes)', station: 'Benches & floor stations', shelf_bin: 'Intake shelf bins' };

const ContainerForm = ({ d, setD, containers, onSave, onCancel, err }: { d: Draft; setD: (d: Draft) => void; containers: SafeContainer[]; onSave: () => void; onCancel: () => void; err: string | null }) => <form data-testid="container-form" data-editing={d.key || undefined} onSubmit={(e) => { e.preventDefault(); onSave(); }} className="rounded-md border border-ink bg-surface p-3 text-xs">
  <div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{d.key ? 'Edit container' : 'New container'}</span><button type="button" data-testid="container-cancel" onClick={onCancel} aria-label="Cancel" className="ml-auto text-ink-400 hover:text-ink"><X size={13} /></button></div>
  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_120px_140px_1fr_1fr]">
    <label className="block"><span className="text-[10px] text-ink-500">Name</span><input data-testid="container-label" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="Safe 2" className={`${field} mt-0.5 w-full`} /></label>
    <label className="block"><span className="text-[10px] text-ink-500">Kind</span><select data-testid="container-kind" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ContainerKind })} className={`${field} mt-0.5 w-full`}><option value="safe">Safe</option><option value="shelf">Shelf</option><option value="bin">Bin / box</option></select></label>
    <label className={clsx('block', d.kind !== 'safe' && 'opacity-40')}><span className="text-[10px] text-ink-500">Insurance limit ($)</span><input data-testid="container-limit" type="number" min={0} step={1000} value={d.limit} disabled={d.kind !== 'safe'} onChange={(e) => setD({ ...d, limit: e.target.value })} className={`${field} mt-0.5 w-full font-mono`} /></label>
    <label className="block"><span className="text-[10px] text-ink-500">Policy ref</span><input data-testid="container-policy" value={d.policyRef} onChange={(e) => setD({ ...d, policyRef: e.target.value })} placeholder="Jewelers Block …" className={`${field} mt-0.5 w-full`} /></label>
    <label className="block"><span className="text-[10px] text-ink-500">Inside (parent container)</span><select data-testid="container-parent" value={d.parent} onChange={(e) => setD({ ...d, parent: e.target.value })} className={`${field} mt-0.5 w-full`}><option value="">— none (stands alone)</option>{containers.filter((c) => c.key !== d.key).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
  </div>
  <div className="mt-2 flex items-center gap-3"><Button type="submit" variant="primary" size="sm" data-testid="container-save">{d.key ? 'Save' : 'Add container'}</Button><span className="text-[10px] text-ink-400">Bins and shelves carry no limit — their value rolls up into the safe they sit in.</span>{err && <span data-testid="container-error" className="text-rose-700">{err}</span>}</div>
</form>;

export default function ContainersPage() {
  const [containers, setContainers] = useState<SafeContainer[]>([]); const [nodes, setNodes] = useState<LocationNode[]>([]); const [draft, setDraft] = useState<Draft | null>(null); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = () => Promise.all([sf.getContainers().then(setContainers), sf.getLocationNodes().then(setNodes)]);
  useEffect(() => { void load(); }, []);
  if (!api.isOwnerSync()) return <div data-testid="containers-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Containers are owner-only (MH).</div>;
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 3500); void load(); };
  const save = async () => { if (!draft) return; try { setErr(null); const c = await sf.saveContainer({ key: draft.key || undefined, label: draft.label, kind: draft.kind, insuranceLimit: draft.kind === 'safe' ? Number(draft.limit) : undefined, policyRef: draft.policyRef, parent: draft.parent || undefined, scanNode: draft.scanNode || undefined }); setDraft(null); say(`${draft.key ? 'Saved' : 'Added'} ${c.label}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } };
  const reparent = async (n: LocationNode, parent: string) => { try { await sf.setNodeParent(n.key, parent || null); say(`${n.label} → ${parent ? containers.find((c) => c.key === parent)?.label : 'no container'}`); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } };
  const nameOf = (k?: string) => (k ? containers.find((c) => c.key === k)?.label ?? k : '—');
  return <div data-testid="containers-page" className="space-y-3">
    <Link to="/setup" data-testid="containers-back" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Setup</Link>
    <PageHeader title="Containers" subtitle="Safes carry an insurance limit and a policy ref · bins / shelves have no limit · every tray, station and shelf bin names the container it physically lives in — the Safes card sums by that parent, so re-parent here when the shop's safes change" action={<div className="flex items-center gap-2"><Link to="/analytics" data-testid="containers-analytics" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 hover:border-ink-300"><Lock size={12} /> Safes vs insurance</Link><Button variant="primary" size="sm" data-testid="containers-add" onClick={() => { setDraft(blank()); setErr(null); }}><Plus size={12} /> Add container</Button></div>} />
    {msg && <p data-testid="containers-msg" className="text-xs text-moss-700">{msg}</p>}
    {draft && <ContainerForm d={draft} setD={setDraft} containers={containers} onSave={() => void save()} onCancel={() => setDraft(null)} err={err} />}
    <Table testId="containers-table">
      <thead><tr><Th>Container</Th><Th>Kind</Th><Th className="text-right">Insurance limit</Th><Th>Policy ref</Th><Th>Inside</Th><Th>Scan node (Move…)</Th><Th>Nodes inside</Th><Th /></tr></thead>
      <tbody>{containers.map((c) => <tr key={c.key} data-testid={`container-row-${c.key}`} data-kind={c.kind} className="align-top">
        <Td className="font-semibold text-ink">{c.label}</Td><Td className="text-xs capitalize">{c.kind}</Td><Td data-testid={`container-limit-${c.key}`} className="text-right font-mono text-xs">{c.insuranceLimit !== undefined ? fmtMoney(c.insuranceLimit) : <span className="text-ink-300">no limit</span>}</Td><Td className="text-xs">{c.policyRef ?? <span className="text-ink-300">—</span>}</Td><Td className="text-xs">{nameOf(c.parent)}</Td><Td className="font-mono text-[11px] text-ink-500">{c.scanNode ?? '—'}</Td>
        <Td data-testid={`container-nodes-${c.key}`} className="max-w-[320px] text-[11px] text-ink-500">{nodes.filter((n) => n.parent === c.key).map((n) => n.label).join(' · ') || <span className="text-ink-300">none</span>}</Td>
        <Td><button type="button" data-testid={`container-edit-${c.key}`} onClick={() => { setDraft(fromC(c)); setErr(null); window.scrollTo({ top: 0 }); }} className="text-xs text-brand hover:underline">Edit</button></Td>
      </tr>)}{!containers.length && <EmptyRow colSpan={8} text="No containers" />}</tbody>
    </Table>
    {(['tray', 'station', 'shelf_bin'] as const).map((g) => <Card key={g} title={GROUP_LABEL[g]} subtitle={g === 'tray' ? 'Scan-in nodes — each is a tray inside a physical safe' : g === 'station' ? 'Benches and floor stations — normally no container: a piece here is in someone\'s hands, not in a safe' : 'Unopened packages wait here — parent the shelf to the FD safe only if it physically lives inside it'} testId={`nodes-${g}`} bodyClassName="p-0">
      <ul className="grid grid-cols-1 divide-y divide-line/70 md:grid-cols-2 md:divide-y-0">{nodes.filter((n) => n.group === g).map((n) => <li key={n.key} data-testid={`node-${n.key}`} data-parent={n.parent ?? ''} className="flex items-center gap-3 px-4 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate text-ink-700">{n.label} <span className="font-mono text-[10px] text-ink-400">{n.key}</span></span>
        <select data-testid={`node-parent-${n.key}`} value={n.parent ?? ''} onChange={(e) => void reparent(n, e.target.value)} className={`${field} w-44`}><option value="">— none (not insured)</option>{containers.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></li>)}</ul>
    </Card>)}
  </div>;
}
