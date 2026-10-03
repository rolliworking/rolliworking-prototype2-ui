import { useState } from 'react';
import * as api from '@/api/client';
import * as org from '@/api/org';
import type { StaffInput } from '@/api/org';
import type { AccessTier, Division, InviteChannel, Role, User } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Lbl, field } from './OrgBits';

export const blankStaff: StaffInput = { firstName: '', shortName: '', dutyLabel: '', accessTier: 'concierge', roles: ['concierge'], division: 'rolliworks', email: '', phone: '', channel: 'email' };
export const staffInputOf = (u: User): StaffInput & { id: string } => ({ id: u.id, firstName: u.firstName, shortName: u.shortName, dutyLabel: u.dutyLabel, accessTier: u.accessTier, roles: [...u.roles], division: u.division, departmentCode: u.departmentCode, reportsTo: u.reportsTo, email: u.email ?? '', phone: u.phone ?? '', channel: u.invite?.channel ?? 'email' });

// One form for create (with invite) and edit (no credentials — those belong to the person)
export const StaffForm = ({ init, users, onClose, onSaved }: { init: StaffInput & { id?: string }; users: User[]; onClose: () => void; onSaved: (u: User, created: boolean) => void }) => {
  const [f, setF] = useState(init); const [err, setErr] = useState<string | null>(null); const editing = !!init.id;
  const save = () => (editing ? org.updateStaff(f as StaffInput & { id: string }) : org.createStaff(f)).then((u) => onSaved(u, !editing)).catch((x) => setErr(x instanceof Error ? x.message : 'Failed'));
  return <Modal testId="staff-form" title={editing ? `Edit ${init.shortName}` : 'New staff member'} width="w-[640px]" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3 p-5 text-xs">
      <Lbl>First name (sign-in key){editing && <span className="ml-1 text-ink-400">· locked</span>}<input data-testid="staff-first" value={f.firstName} disabled={editing} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="e.g. priya" className={`${field} disabled:opacity-60`} /></Lbl>
      <Lbl>Short name (shown everywhere)<input data-testid="staff-short" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} placeholder="e.g. PR" className={field} /></Lbl>
      <Lbl className="col-span-2">Duty label (display only — access is the tier)<input data-testid="staff-duty" value={f.dutyLabel} onChange={(e) => setF({ ...f, dutyLabel: e.target.value })} placeholder="e.g. Band tech" className={field} /></Lbl>
      <Lbl>Access tier<select data-testid="staff-tier" value={f.accessTier} onChange={(e) => setF({ ...f, accessTier: e.target.value as AccessTier })} className={field}><option value="manager">manager</option><option value="supervisor">supervisor</option><option value="concierge">concierge</option></select></Lbl>
      <Lbl>Entity<select data-testid="staff-entity" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value as Division | 'both' })} className={field}>{org.getEntitiesSync().map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}<option value="both">both</option></select></Lbl>
      <Lbl>Department<select data-testid="staff-dept" value={f.departmentCode ?? ''} onChange={(e) => setF({ ...f, departmentCode: e.target.value || undefined })} className={field}><option value="">— none (front desk / management)</option>{org.getDepartmentsSync().filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}</select></Lbl>
      <Lbl>Reports to<select data-testid="staff-reports-to" value={f.reportsTo ?? ''} onChange={(e) => setF({ ...f, reportsTo: e.target.value || undefined })} className={field}><option value="">— nobody (top of tree)</option>{users.filter((u) => u.id !== init.id && !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel}</option>)}</select></Lbl>
      <div className="col-span-2">Roles<div className="mt-1 flex flex-wrap gap-3">{api.ROLES.map((r: Role) => <label key={r} className="inline-flex items-center gap-1"><input data-testid={`staff-role-${r}`} type="checkbox" checked={f.roles.includes(r)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} />{r}</label>)}</div></div>
      <Lbl>Email<input data-testid="staff-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@rolliworks.com" className={field} /></Lbl>
      <Lbl>Mobile<input data-testid="staff-phone" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(212) 555-0100" className={field} /></Lbl>
      {!editing && <div className="col-span-2 rounded-sm bg-canvas px-3 py-2"><div className="font-semibold text-ink">Invite · one-time 6-digit code</div><div className="mt-1 flex items-center gap-4">{(['email', 'sms'] as InviteChannel[]).map((c) => <label key={c} className="inline-flex items-center gap-1"><input type="radio" data-testid={`staff-channel-${c}`} checked={f.channel === c} onChange={() => setF({ ...f, channel: c })} /> {c === 'email' ? 'Email' : 'SMS'}</label>)}<span className="text-[11px] text-ink-400">MOCK delivery — the code is shown in the Staff list and recorded in Sent. Expires in {org.INVITE_TTL_H} h. The person picks their own password + PIN on first sign-in.</span></div></div>}
      {err && <p data-testid="staff-error" className="col-span-2 font-medium text-rose-700">{err}</p>}
      <div className="col-span-2 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="staff-save" onClick={save}>{editing ? 'Save' : 'Create & send invite'}</Button></div>
    </div>
  </Modal>;
};
