import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { AccessTier, CatalogService, DeptCode, Division, LineType, MessageTemplate, PersonalTemplate, Role, User } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { field, Flash, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';
import { BookingRulesCard } from '@/pages/SchedulePage';

type UserForm = { id?: string; firstName: string; shortName: string; dutyLabel: string; accessTier: AccessTier; roles: Role[]; division: Division | 'both'; password: string; pin: string };
const blankUser: UserForm = { firstName: '', shortName: '', dutyLabel: '', accessTier: 'concierge', roles: ['concierge'], division: 'rolliworks', password: '', pin: '1234' };

export function SetupRsPanels() {
  const { data, error, msg, run } = useLoad(async () => ({ users: await api.getUsers(), catalog: await api.getCatalogAdmin(), templates: await api.getTemplates(), variants: await api.getAllPersonalTemplates(), locations: await api.getLocations() }));
  const [uf, setUf] = useState<UserForm | null>(null);
  const [cf, setCf] = useState<{ id?: string; name: string; dept: DeptCode; rate: number; type: LineType } | null>(null);
  const [tf, setTf] = useState<MessageTemplate | null>(null); const [tq, setTq] = useState(''); const [showRetired, setShowRetired] = useState(false);
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
    <Card title="Email template manager" subtitle={<span className="inline-flex items-center gap-1.5">Central source for every email the system sends — client, vendor (PO) and internal (receiving report) · point-of-use edits at send time stay allowed (Q32) · retire instead of delete <Provisional note="Templates are edited here; some legacy Outbox writers still take bodies from code — wiring pending" /></span>} bodyClassName="p-0" testId="setup-templates-card" action={<div className="flex items-center gap-2"><input data-testid="template-search" value={tq} onChange={(e) => setTq(e.target.value)} placeholder="Search name · subject · where used" className={`${field} w-56`} /><label className="inline-flex items-center gap-1 text-xs text-ink-500"><input type="checkbox" data-testid="template-show-retired" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> retired</label></div>}>
      <ul className="divide-y divide-line/70">{data.templates.filter((t: MessageTemplate) => (showRetired || t.active !== false) && (!tq.trim() || [t.name, t.subject, t.usedBy ?? '', t.audience ?? ''].join(' ').toLowerCase().includes(tq.trim().toLowerCase()))).map((t: MessageTemplate) => <li key={t.key} data-testid={`template-${t.key}`} data-active={t.active !== false} className={`flex items-start justify-between gap-3 px-4 py-2 text-xs ${t.active === false ? 'opacity-50' : ''}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5 font-medium text-ink">{t.name} <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.audience === 'vendor' ? 'bg-amber-50 text-amber-900' : t.audience === 'internal' ? 'bg-canvas text-ink-600' : 'bg-sky-50 text-sky-800'}`}>{t.audience ?? 'client'}</span>{t.active === false && <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">RETIRED</span>}<span className="font-normal text-ink-400">· {t.subject}</span></div><div className="text-[11px] text-ink-500">used by: {t.usedBy ?? '—'}</div><div className="mt-0.5 flex flex-wrap gap-1">{t.mergeFields.map((f) => <span key={f} className="rounded bg-canvas px-1 font-mono text-[10px] text-ink-500">{f}</span>)}</div><TemplateVariants rows={data.variants.filter((v: PersonalTemplate) => v.key === t.key)} tkey={t.key} /><div className="text-[11px] text-ink-400">updated {fmtDate(t.at)} by {t.updatedBy}</div></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" data-testid={`template-edit-${t.key}`} onClick={() => setTf(t)}>Edit</Button><Button size="sm" variant="ghost" data-testid={`template-toggle-${t.key}`} onClick={() => run(() => api.setTemplateActive(t.key, t.active === false), t.active === false ? 'Template reactivated' : 'Template retired — history kept')}>{t.active === false ? 'Reactivate' : 'Retire'}</Button></div></li>)}</ul>
    </Card>
    <BookingRulesCard />
    <FeatureSwitchesCard />
    <RcAccessCard />
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

// Read-only for managers: who has a personal version of this template (shop default stays the home; system sends never use variants)
const TemplateVariants = ({ rows, tkey }: { rows: PersonalTemplate[]; tkey: string }) => (
  <details data-testid={`template-variants-${tkey}`} className="mt-1 text-[11px]"><summary className={`cursor-pointer ${rows.length ? 'text-amber-800' : 'text-ink-400'}`}>Variants ({rows.length}){rows.length ? ' · personal versions, read-only here' : ''}</summary>
    {rows.length > 0 && <ul className="mt-1 space-y-1">{rows.map((v) => <li key={v.owner} data-testid={`template-variant-${tkey}-${v.owner}`} className="rounded-sm border border-amber-200 bg-amber-50/60 p-2"><div className="font-medium text-amber-900">{v.owner}’s version <span className="font-normal text-ink-400">· {fmtDate(v.updatedAt)}</span></div><div className="text-ink-700">{v.subject}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] text-ink-500">{v.body}</pre></li>)}</ul>}
  </details>
);

// Feature switches — manager-level on/off without a code change
export const FeatureSwitchesCard = () => {
  const [flags, setFlags] = useState<Record<api.FeatureKey, boolean> | null>(null); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void api.getFeatureFlags().then(setFlags); }, []);
  if (!flags) return null;
  return <Card title="Feature switches" subtitle="Turn client-facing behaviour on/off — off falls back to the staff flow, no gap" testId="feature-switches-card">
    <ul className="divide-y divide-line/70 text-xs">{(Object.keys(flags) as api.FeatureKey[]).map((k) => <li key={k} data-testid={`feature-${k}`} data-on={flags[k]} className="flex items-start justify-between gap-3 py-2"><div><div className="font-medium text-ink">{api.FEATURE_META[k].label}</div><div className="text-ink-500">{api.FEATURE_META[k].blurb}</div></div><button data-testid={`feature-toggle-${k}`} role="switch" aria-checked={flags[k]} onClick={() => void api.setFeatureFlag(k, !flags[k]).then((f) => { setFlags(f); setMsg(`${api.FEATURE_META[k].label}: ${f[k] ? 'ON' : 'OFF'}`); setTimeout(() => setMsg(null), 2000); })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${flags[k] ? 'bg-moss-600' : 'bg-ink-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${flags[k] ? 'left-[22px]' : 'left-0.5'}`} /></button></li>)}</ul>
    {msg && <div data-testid="feature-flash" className="mt-2 rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{msg}</div>}
  </Card>;
};

// RolliConnect access — per-document gating by type + client accounts (password + TOTP replaced magic links)
export const RcAccessCard = () => {
  const [access, setAccess] = useState<Record<api.RcDocType, api.RcDocAccess> | null>(null); const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof api.rcListAccounts>>>([]); const [msg, setMsg] = useState<string | null>(null);
  const load = () => Promise.all([api.getRcDocAccess().then(setAccess), api.rcListAccounts().then(setAccounts)]);
  useEffect(() => { void load(); }, []);
  if (!access) return null;
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2500); };
  return <Card title="RolliConnect access" subtitle="Client login = email + password + authenticator (magic links retired). Identity-bound pages always need the account; tokened documents can stay public links." testId="rc-access-card">
    <ul className="divide-y divide-line/70 text-xs" data-testid="rc-doc-access">{(Object.keys(api.RC_DOC_META) as api.RcDocType[]).map((k) => { const m = api.RC_DOC_META[k]; const v = access[k]; return <li key={k} data-testid={`rc-doc-${k}`} data-access={v} className="flex items-start justify-between gap-3 py-2"><div><div className="font-medium text-ink">{m.label}</div><div className="text-ink-500">{m.blurb}</div></div><span className="inline-flex shrink-0 overflow-hidden rounded-sm border border-line">{(['login', 'public'] as api.RcDocAccess[]).map((opt) => <button key={opt} type="button" data-testid={`rc-doc-${k}-${opt}`} aria-pressed={v === opt} disabled={opt === 'public' && !m.lockable} title={opt === 'public' && !m.lockable ? 'Identity-bound — cannot be public' : undefined} onClick={() => void api.setRcDocAccess(k, opt).then((n) => { setAccess(n); say(`${m.label.split(' ·')[0]} → ${opt === 'public' ? 'public link' : 'login required'}`); }).catch((e) => say(e instanceof Error ? e.message : 'Failed'))} className={`px-2.5 py-1 font-medium transition-colors ${v === opt ? 'bg-ink text-white' : 'bg-surface text-ink-600 hover:bg-canvas'} disabled:opacity-40`}>{opt === 'public' ? 'Public link' : 'Login required'}</button>)}</span></li>; })}</ul>
    <div className="mt-3 border-t border-line pt-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Client accounts · {accounts.length}</div>
      <ul className="divide-y divide-line/70 text-xs" data-testid="rc-accounts">{accounts.map((a) => <li key={a.clientId} data-testid={`rc-account-${a.clientId}`} className="flex flex-wrap items-center gap-2 py-1.5"><span className="font-medium text-ink">{a.clientName}</span><span className="text-ink-500">{a.email}</span><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${a.totpEnabled ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800'}`}>{a.totpEnabled ? 'TOTP on' : 'TOTP pending'}</span><span className="text-ink-400">backup codes {a.backupCodes.length - a.usedBackupCodes.length}/{a.backupCodes.length}</span><span className="text-ink-400">created {fmtDate(a.createdAt)}{a.lastLoginAt ? ` · last sign-in ${fmtDate(a.lastLoginAt)}` : ''}</span><button type="button" data-testid={`rc-account-reset-${a.clientId}`} onClick={() => { if (window.confirm(`Reset ${a.clientName}'s RolliConnect account? They will need to sign up again.`)) void api.rcResetAccount(a.clientId).then(() => { say('Account reset'); void load(); }).catch((e) => say(e instanceof Error ? e.message : 'Failed')); }} className="ml-auto text-rose-700 hover:underline">Reset account</button></li>)}{!accounts.length && <li className="py-2 text-ink-400">No client accounts yet.</li>}</ul>
    </div>
    <p className="mt-2 text-[10px] text-ink-400">Photos: every staff photo is private by default — unlock per photo on the job (Photos panel / RW photo grid) to publish it behind the client’s login.</p>
    {msg && <div data-testid="rc-access-flash" className="mt-2 rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{msg}</div>}
  </Card>;
};
