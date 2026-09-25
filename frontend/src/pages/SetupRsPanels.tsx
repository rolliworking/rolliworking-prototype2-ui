import { useState } from 'react';
import * as api from '@/api/client';
import type { AccessTier, CatalogService, DeptCode, Division, LineType, MessageTemplate, Role, User } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

type UserForm = { id?: string; firstName: string; shortName: string; dutyLabel: string; accessTier: AccessTier; roles: Role[]; division: Division | 'both'; password: string; pin: string };
const blankUser: UserForm = { firstName: '', shortName: '', dutyLabel: '', accessTier: 'concierge', roles: ['concierge'], division: 'rolliworks', password: '', pin: '1234' };

export function SetupRsPanels() {
  const { data, error, msg, run } = useLoad(async () => ({ users: await api.getUsers(), catalog: await api.getCatalogAdmin(), templates: await api.getTemplates(), locations: await api.getLocations() }));
  const [uf, setUf] = useState<UserForm | null>(null);
  const [cf, setCf] = useState<{ id?: string; name: string; dept: DeptCode; rate: number; type: LineType } | null>(null);
  const [tf, setTf] = useState<MessageTemplate | null>(null);
  if (!data) return null;
  return <>
    <Flash error={error} msg={msg} />
    <Card title="Users & roles" subtitle="Create / deactivate · tier · duty label (display-only) · division · mock password & PIN" action={<Button size="sm" data-testid="user-new" onClick={() => setUf(blankUser)}>Add user</Button>} bodyClassName="p-0" testId="setup-users-card">
      <Table><thead><tr><Th>Short</Th><Th>Duty label</Th><Th>Tier</Th><Th>Roles</Th><Th>Division</Th><Th /></tr></thead><tbody>
        {data.users.map((u: User) => <tr key={u.id} data-testid={`user-row-${u.id}`}><Td className="text-xs font-semibold">{u.shortName}</Td><Td className="text-xs text-ink-500">{u.dutyLabel}</Td><Td className="text-xs capitalize">{u.accessTier}</Td><Td className="text-xs">{u.roles.join(', ')}</Td><Td className="text-xs capitalize">{u.division}</Td><Td className="text-right"><Button size="sm" variant="ghost" data-testid={`user-edit-${u.id}`} onClick={() => setUf({ id: u.id, firstName: u.firstName, shortName: u.shortName, dutyLabel: u.dutyLabel, accessTier: u.accessTier, roles: u.roles, division: u.division, password: u.password, pin: u.pin })}>Edit</Button><Button size="sm" variant="ghost" data-testid={`user-deactivate-${u.id}`} onClick={() => run(() => api.adminDeactivateUser(u.id), `${u.shortName} deactivated`)}>Deactivate</Button></Td></tr>)}
      </tbody></Table>
    </Card>
    <Card title="Service catalog" subtitle="Add / edit / retire · department attribution drives the P&L" action={<Button size="sm" data-testid="catalog-new" onClick={() => setCf({ name: '', dept: 'W', rate: 0, type: 'service' })}>Add service</Button>} bodyClassName="p-0" testId="setup-catalog-card">
      <Table><thead><tr><Th>Service</Th><Th>Dept</Th><Th>Type</Th><Th className="text-right">Rate</Th><Th /></tr></thead><tbody>
        {data.catalog.map((c: CatalogService & { retired: boolean }) => <tr key={c.id} data-testid={`catalog-row-${c.id}`} className={c.retired ? 'opacity-50' : ''}><Td className="text-xs">{c.name}{c.retired && <span className="ml-1 text-[10px] text-ink-400">retired</span>}</Td><Td><DeptBadge code={c.dept} /></Td><Td className="text-xs capitalize">{c.type}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(c.rate)}</Td><Td className="text-right"><Button size="sm" variant="ghost" data-testid={`catalog-edit-${c.id}`} onClick={() => setCf({ id: c.id, name: c.name, dept: c.dept, rate: c.rate, type: c.type })}>Edit</Button><Button size="sm" variant="ghost" data-testid={`catalog-retire-${c.id}`} onClick={() => run(() => api.retireCatalogService(c.id, !c.retired), c.retired ? 'Restored' : 'Retired')}>{c.retired ? 'Restore' : 'Retire'}</Button></Td></tr>)}
      </tbody></Table>
    </Card>
    <Card title="Message templates" subtitle={<span className="inline-flex items-center gap-1.5">Six client emails · merge fields shown as {'{{field}}'} <Provisional note="Templates are edited here but Outbox bodies still come from code — wiring pending" /></span> as unknown as string} bodyClassName="p-0" testId="setup-templates-card">
      <ul className="divide-y divide-line/70">{data.templates.map((t: MessageTemplate) => <li key={t.key} data-testid={`template-${t.key}`} className="flex items-start justify-between gap-3 px-4 py-2 text-xs"><div className="min-w-0"><div className="font-medium text-ink">{t.name} <span className="text-ink-400">· {t.subject}</span></div><div className="mt-0.5 flex flex-wrap gap-1">{t.mergeFields.map((f) => <span key={f} className="rounded bg-canvas px-1 font-mono text-[10px] text-ink-500">{f}</span>)}</div><div className="text-[11px] text-ink-400">updated {fmtDate(t.at)} by {t.updatedBy}</div></div><Button size="sm" variant="ghost" data-testid={`template-edit-${t.key}`} onClick={() => setTf(t)}>Edit</Button></li>)}</ul>
    </Card>
    <div className="grid grid-cols-2 gap-4">
      <Card title="Locations" subtitle="Stock locations · division-stamped" bodyClassName="p-0" testId="setup-locations-card"><ul className="divide-y divide-line/70">{data.locations.map((l) => <li key={l.id} className="flex justify-between px-4 py-2 text-xs"><span>{l.name}</span><span className="capitalize text-ink-500">{l.kind} · {l.division}</span></li>)}</ul><p className="px-4 py-2 text-[11px] text-ink-400">Add / edit locations <Provisional note="stub — not built" /></p></Card>
      <Card title="Printers" subtitle="Label & receipt printers" testId="setup-printers-card"><ul className="space-y-1 text-xs"><li className="flex justify-between"><span>Front Desk label printer (PDF417)</span><span className="text-amber-800">mock</span></li><li className="flex justify-between"><span>Receipt printer</span><span className="text-amber-800">mock</span></li></ul><p className="mt-2 text-[11px] text-ink-400">Print jobs set a flag in the Label Queue <Provisional note="stub — no driver" /></p></Card>
    </div>
    {uf && <Modal testId="user-modal" title={uf.id ? `Edit ${uf.shortName}` : 'New user'} onClose={() => setUf(null)}>
      <div className="grid grid-cols-2 gap-2 text-xs text-ink-500">
        <label>First name<input data-testid="user-first" value={uf.firstName} onChange={(e) => setUf({ ...uf, firstName: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
        <label>Short name (actor key)<input data-testid="user-short" value={uf.shortName} onChange={(e) => setUf({ ...uf, shortName: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
        <label className="col-span-2">Duty label (display only)<input data-testid="user-duty" value={uf.dutyLabel} onChange={(e) => setUf({ ...uf, dutyLabel: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
        <label>Access tier<select data-testid="user-tier" value={uf.accessTier} onChange={(e) => setUf({ ...uf, accessTier: e.target.value as AccessTier })} className={`${field} mt-1 block w-full`}><option value="manager">manager</option><option value="concierge">concierge</option></select></label>
        <label>Division<select data-testid="user-division" value={uf.division} onChange={(e) => setUf({ ...uf, division: e.target.value as Division | 'both' })} className={`${field} mt-1 block w-full`}><option value="rolliworks">rolliworks</option><option value="rollishop">rollishop</option><option value="both">both</option></select></label>
        <div className="col-span-2">Roles<div className="mt-1 flex gap-3">{api.ROLES.map((r) => <label key={r} className="inline-flex items-center gap-1"><input data-testid={`user-role-${r}`} type="checkbox" checked={uf.roles.includes(r)} onChange={(e) => setUf({ ...uf, roles: e.target.checked ? [...uf.roles, r] : uf.roles.filter((x) => x !== r) })} />{r}</label>)}</div></div>
        <label>Password (mock)<input data-testid="user-password" value={uf.password} onChange={(e) => setUf({ ...uf, password: e.target.value })} className={`${field} mt-1 block w-full font-mono`} /></label>
        <label>PIN (4 digits)<input data-testid="user-pin" value={uf.pin} onChange={(e) => setUf({ ...uf, pin: e.target.value })} className={`${field} mt-1 block w-full font-mono`} /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setUf(null)}>Cancel</Button><Button variant="primary" data-testid="user-save" onClick={() => run(async () => { await api.adminSaveUser(uf); setUf(null); }, 'User saved')}>Save</Button></div>
    </Modal>}
    {cf && <Modal testId="catalog-modal" title={cf.id ? 'Edit service' : 'New service'} onClose={() => setCf(null)}>
      <div className="grid grid-cols-3 gap-2 text-xs text-ink-500"><label className="col-span-3">Name<input data-testid="catalog-name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} className={`${field} mt-1 block w-full`} /></label><label>Dept<select data-testid="catalog-dept" value={cf.dept} onChange={(e) => setCf({ ...cf, dept: e.target.value as DeptCode })} className={`${field} mt-1 block w-full`}>{(['W', 'B', 'P', 'PM'] as DeptCode[]).map((d) => <option key={d}>{d}</option>)}</select></label><label>Type<select data-testid="catalog-type" value={cf.type} onChange={(e) => setCf({ ...cf, type: e.target.value as LineType })} className={`${field} mt-1 block w-full`}><option value="service">service</option><option value="part">part</option><option value="shipping">shipping</option></select></label><label>Rate<input data-testid="catalog-rate" type="number" min={0} value={cf.rate} onChange={(e) => setCf({ ...cf, rate: Number(e.target.value) })} className={`${field} mt-1 block w-full text-right`} /></label></div>
      <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setCf(null)}>Cancel</Button><Button variant="primary" data-testid="catalog-save" onClick={() => run(async () => { await api.saveCatalogService(cf); setCf(null); }, 'Catalog saved')}>Save</Button></div>
    </Modal>}
    {tf && <Modal testId="template-modal" title={tf.name} width="w-[640px]" onClose={() => setTf(null)}>
      <label className="block text-xs text-ink-500">Subject<input data-testid="template-subject" value={tf.subject} onChange={(e) => setTf({ ...tf, subject: e.target.value })} className={`${field} mt-1 block w-full`} /></label>
      <label className="mt-2 block text-xs text-ink-500">Body<textarea data-testid="template-body" rows={8} value={tf.body} onChange={(e) => setTf({ ...tf, body: e.target.value })} className={`${field} mt-1 block w-full font-mono text-[11px]`} /></label>
      <div className="mt-2 flex flex-wrap gap-1">{api.MERGE_FIELDS.map((f) => <button key={f} data-testid={`merge-${f}`} onClick={() => setTf({ ...tf, body: `${tf.body} ${f}` })} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-600 hover:bg-line">{f}</button>)}</div>
      <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setTf(null)}>Cancel</Button><Button variant="primary" data-testid="template-save" onClick={() => run(async () => { await api.saveTemplate(tf.key, tf.subject, tf.body); setTf(null); }, 'Template saved')}>Save</Button></div>
    </Modal>}
  </>;
}
