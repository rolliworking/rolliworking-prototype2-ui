import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import * as org from '@/api/org';
import type { Department, DepartmentInput } from '@/api/org';
import type { DeptCode, Division } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { Lbl, StatusDot, Toggle, field } from './OrgBits';

const blank: DepartmentInput = { code: '', name: '', entity: 'rolliworks', queue: '', keepsDots: true, skuKeywords: [], active: true };

const DeptForm = ({ init, onClose, onSaved }: { init: DepartmentInput; onClose: () => void; onSaved: (d: Department) => void }) => {
  const [f, setF] = useState<DepartmentInput>(init); const [kw, setKw] = useState(init.skuKeywords.join(', ')); const [err, setErr] = useState<string | null>(null);
  const isLeg = !!init.dotLeg; const editing = !!init.code && org.departmentSync(init.code);
  const save = () => org.saveDepartment({ ...f, skuKeywords: kw.split(',').map((s) => s.trim()).filter(Boolean) }).then(onSaved).catch((x) => setErr(x instanceof Error ? x.message : 'Failed'));
  return <Modal testId="dept-form" title={editing ? `Edit ${init.code} · ${init.name}` : 'New department'} onClose={onClose}>
    <div className="grid grid-cols-2 gap-3 p-5 text-xs">
      <Lbl>Code (1–3 letters)<input data-testid="dept-code" value={f.code} disabled={!!editing} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className={`${field} font-mono uppercase disabled:opacity-60`} /></Lbl>
      <Lbl>Name<input data-testid="dept-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} /></Lbl>
      <Lbl>Entity<select data-testid="dept-entity" value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value as Division | 'both' })} className={field}>{org.getEntitiesSync().map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}<option value="both">both</option></select></Lbl>
      <Lbl>Queue it routes to<input data-testid="dept-queue" value={f.queue} onChange={(e) => setF({ ...f, queue: e.target.value })} placeholder="e.g. Engraving" className={field} /></Lbl>
      <Lbl className="col-span-2">SKU keywords (comma-separated — a line whose description contains one lands the job in this queue)<input data-testid="dept-keywords" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="engrav, laser" className={field} /></Lbl>
      <div className="col-span-2 rounded-sm bg-canvas px-3 py-2 text-[11px] text-ink-600">{isLeg ? <>Dot leg <DeptBadge code={init.dotLeg!} /> — this department colours a component and takes completion credit. Its leg is locked.</> : <>Routing-only department: the job shows in this queue <b>and keeps its W·B·P dots</b> (D-497). Dot legs W · B · P · PM are fixed by the component model.</>}</div>
      <div className="col-span-2 flex items-center gap-4"><Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} testId="dept-active" label="Active" />{!isLeg && <Toggle on={f.keepsDots} onChange={(v) => setF({ ...f, keepsDots: v })} testId="dept-keeps-dots" label="Keeps W·B·P dots" />}</div>
      {err && <p data-testid="dept-error" className="col-span-2 font-medium text-rose-700">{err}</p>}
      <div className="col-span-2 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="dept-save" onClick={save}>Save</Button></div>
    </div>
  </Modal>;
};

export const DepartmentsTab = ({ onFlash }: { onFlash: (m: string, err?: boolean) => void }) => {
  const [list, setList] = useState<Department[]>(() => org.getDepartmentsSync()); const [edit, setEdit] = useState<DepartmentInput | null>(null);
  const [routed, setRouted] = useState<Record<string, { number: string; id: string }[]> | null>(null);
  useEffect(() => { void api.getJobs().then((jobs) => { const m: Record<string, { number: string; id: string }[]> = {}; jobs.filter((j) => j.status !== 'closed').forEach((j) => org.routeDepartmentsSync(j.lines).forEach((d) => (m[d.code] = [...(m[d.code] ?? []), { number: j.number, id: j.id }]))); setRouted(m); }).catch(() => setRouted({})); }, []);
  return <div data-testid="org-departments" className="space-y-3">
    <Card title="Departments" subtitle="W · B · P · PM are the dot legs (component colour + credit). CM and EN route a job into an extra queue and keep the dots." action={<Button size="sm" data-testid="dept-new" onClick={() => setEdit(blank)}><Plus size={12} /> Add department</Button>} bodyClassName="p-0">
      <Table><thead><tr><Th>Code</Th><Th>Name</Th><Th>Entity</Th><Th>Queue</Th><Th>Kind</Th><Th>SKU keywords</Th><Th>Routed now</Th><Th>Status</Th><Th /></tr></thead><tbody>
        {list.map((d) => <tr key={d.code} data-testid={`dept-row-${d.code}`} data-active={d.active} className={d.active ? '' : 'opacity-50'}>
          <Td>{d.dotLeg ? <DeptBadge code={d.dotLeg} /> : <span className="rounded-sm border border-dashed border-ink-300 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-700">{d.code}</span>}</Td>
          <Td className="text-xs font-medium text-ink">{d.name}{d.provisional && <span data-testid={`dept-provisional-${d.code}`} title={d.provisional} className="ml-1.5 rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">confirm label</span>}</Td>
          <Td className="text-xs text-ink-500">{d.entity === 'both' ? 'both' : api.entityName(d.entity)}</Td>
          <Td className="text-xs">{d.queue}</Td>
          <Td className="text-[11px] text-ink-500">{d.dotLeg ? `dot leg ${d.dotLeg}` : `routing · ${d.keepsDots ? 'keeps dots' : 'no dots'}`}</Td>
          <Td className="font-mono text-[11px] text-ink-500">{d.skuKeywords.join(', ') || '—'}</Td>
          <Td data-testid={`dept-routed-${d.code}`} className="text-xs">{d.dotLeg ? <span className="text-ink-300">—</span> : routed === null ? '…' : (routed[d.code] ?? []).length ? (routed[d.code] ?? []).map((j) => <a key={j.id} href={`/jobs/${j.id}`} data-testid={`dept-routed-${d.code}-${j.id}`} className="mr-1 font-mono text-brand hover:underline">{j.number}</a>) : <span className="text-ink-400">none</span>}</Td>
          <Td><StatusDot status={d.active ? 'active' : 'inactive'} /></Td>
          <Td className="text-right"><Button size="sm" variant="ghost" data-testid={`dept-edit-${d.code}`} onClick={() => setEdit({ ...d })}>Edit</Button></Td>
        </tr>)}
      </tbody></Table>
    </Card>
    <p className="text-[11px] text-ink-400">Rule check: a job whose estimate carries an Engraving SKU (e.g. E02025 · “Caseback engraving”) appears in the <b>Engraving</b> queue on Jobs → Queue and still shows its W dot. Dot legs: {(['W', 'B', 'P', 'PM'] as DeptCode[]).map((c) => <DeptBadge key={c} code={c} className="ml-1" />)}</p>
    {edit && <DeptForm init={edit} onClose={() => setEdit(null)} onSaved={(d) => { setEdit(null); setList(org.getDepartmentsSync()); onFlash(`${d.code} ${d.name} saved`); }} />}
  </div>;
};
