import { Ban, CheckCircle2, KeyRound, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import * as org from '@/api/org';
import type { StaffRow, StaffStatus } from '@/api/org';
import type { User } from '@/api/client';
import { Button, FilterChip } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { StatusDot, field } from './OrgBits';
import { StaffForm, blankStaff, staffInputOf } from './StaffForm';

const AccountModal = ({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (m: string) => void }) => {
  const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = () => api.setUserEnabled(user.id, !!user.disabled, reason).then(() => onDone(`${user.shortName} ${user.disabled ? 're-enabled' : 'disabled'}`)).catch((x) => setErr(x instanceof Error ? x.message : 'Failed'));
  return <Modal testId="staff-account-modal" title={`${user.disabled ? 'Re-enable' : 'Disable'} ${user.shortName}`} onClose={onClose}>
    <div className="space-y-3 p-5 text-xs text-ink-600">
      <p>{user.disabled ? `Disabled ${new Date(user.disabled.at).toLocaleDateString()} by ${user.disabled.by} — “${user.disabled.reason}”.` : 'Blocks every sign-in (password, PIN, Touch ID) and the time clock. The person stays in history and reports.'} Reason required — logged to the access change log.</p>
      <input data-testid="staff-account-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={`${field} mt-0`} autoFocus />
      {err && <p data-testid="staff-account-error" className="font-medium text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button>{user.disabled ? <Button variant="primary" data-testid="staff-account-confirm" disabled={!reason.trim()} onClick={go}><CheckCircle2 size={13} /> Enable</Button> : <Button data-testid="staff-account-confirm" disabled={!reason.trim()} onClick={go} className="border-rose-300 text-rose-700"><Ban size={13} /> Disable</Button>}</div>
    </div>
  </Modal>;
};

export const StaffTab = ({ onFlash }: { onFlash: (m: string, err?: boolean) => void }) => {
  const [rows, setRows] = useState<StaffRow[]>(() => org.getStaffSync()); const [filter, setFilter] = useState<'all' | StaffStatus>('all'); const [q, setQ] = useState('');
  const [form, setForm] = useState<ReturnType<typeof staffInputOf> | typeof blankStaff | null>(null); const [account, setAccount] = useState<User | null>(null);
  const owner = api.isOwnerSync(); const users = rows.map((r) => r.user);
  const reload = () => setRows(org.getStaffSync());
  const counts = (s: StaffStatus) => rows.filter((r) => r.status === s).length;
  const shown = rows.filter((r) => (filter === 'all' || r.status === filter) && (!q.trim() || `${r.user.shortName} ${r.user.dutyLabel} ${r.user.firstName} ${r.user.email ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const resend = (u: User) => org.resendStaffInvite(u.id).then((n) => { reload(); onFlash(`Invite resent to ${n.shortName} · new code ${n.invite?.code} (gen ${n.invite?.generation}) · recorded in Sent`); }).catch((x) => onFlash(x instanceof Error ? x.message : 'Failed', true));
  return <div data-testid="org-staff" className="space-y-3">
    <Card title="Staff" subtitle="Every person, one list — create with an invite, assign roles / department / manager, disable with a reason. Credentials belong to the person (set on first sign-in)." action={<div className="flex items-center gap-2"><input data-testid="staff-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-40 rounded-sm border border-line bg-canvas px-2 text-xs focus:border-ink focus:outline-none" /><Button size="sm" variant="primary" data-testid="staff-new" onClick={() => setForm(blankStaff)}><Plus size={12} /> New staff</Button></div>} bodyClassName="p-0">
      <div className="flex flex-wrap gap-1 border-b border-line px-4 py-2" data-testid="staff-filters">{(['all', 'active', 'invited', 'expired', 'disabled'] as const).map((k) => <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} testId={`staff-filter-${k}`}>{k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)} <span className="ml-1 opacity-60">{k === 'all' ? rows.length : counts(k)}</span></FilterChip>)}</div>
      <Table><thead><tr><Th>Person</Th><Th>Entity · dept</Th><Th>Tier · roles</Th><Th>Reports to</Th><Th>Contact</Th><Th>Status</Th><Th>Invite</Th><Th /></tr></thead><tbody>
        {shown.map(({ user: u, status, manager, department }) => <tr key={u.id} data-testid={`staff-row-${u.id}`} data-status={status} className={status === 'disabled' ? 'opacity-60' : ''}>
          <Td><div className="text-xs font-semibold text-ink">{u.shortName}{u.id === api.OWNER_USER_ID && <span className="ml-1 rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">owner</span>}</div><div className="text-[11px] text-ink-500">{u.dutyLabel} · <span className="font-mono">{u.firstName}</span></div></Td>
          <Td className="text-xs text-ink-600">{api.entityName(u.division)}{department && <div className="text-[11px] text-ink-400">{department.code} · {department.name}</div>}</Td>
          <Td className="text-xs"><span className="capitalize text-ink">{u.accessTier}</span><div className="text-[11px] text-ink-400">{u.roles.join(', ')}</div></Td>
          <Td data-testid={`staff-manager-${u.id}`} className="text-xs text-ink-600">{manager?.shortName ?? <span className="text-ink-300">—</span>}</Td>
          <Td className="text-[11px] text-ink-500">{u.email && <div>{u.email}</div>}{u.phone && <div>{u.phone}</div>}{!u.email && !u.phone && <span className="text-ink-300">—</span>}</Td>
          <Td data-testid={`staff-status-${u.id}`}><StatusDot status={status} />{u.disabled && <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-ink-400" title={u.disabled.reason}>{u.disabled.reason}</div>}</Td>
          <Td className="text-[11px]">{u.invite && !u.invite.usedAt ? <div data-testid={`staff-invite-${u.id}`}><span className="inline-flex items-center gap-1 rounded-sm bg-sky-50 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-widest text-sky-900"><KeyRound size={10} /> <span data-testid={`staff-invite-code-${u.id}`}>{u.invite.code}</span></span><div className="text-[10px] text-ink-400">{u.invite.channel} · gen {u.invite.generation} · {status === 'expired' ? 'expired' : `expires ${new Date(u.invite.expiresAt).toLocaleDateString()}`} · MOCK</div></div> : u.invite?.usedAt ? <span className="text-ink-400">activated {new Date(u.invite.usedAt).toLocaleDateString()}</span> : <span className="text-ink-300">—</span>}</Td>
          <Td className="whitespace-nowrap text-right">
            <Button size="sm" variant="ghost" data-testid={`staff-edit-${u.id}`} onClick={() => setForm(staffInputOf(u))}>Edit</Button>
            {u.invite && !u.invite.usedAt && <Button size="sm" variant="ghost" data-testid={`staff-resend-${u.id}`} onClick={() => void resend(u)} title="Rotate the code and send again"><RefreshCw size={11} /> Resend</Button>}
            {owner && u.id !== api.OWNER_USER_ID && <Button size="sm" variant="ghost" data-testid={`staff-account-${u.id}`} onClick={() => setAccount(u)} className={u.disabled ? 'text-moss-700' : 'text-rose-700'}>{u.disabled ? 'Enable' : 'Disable'}</Button>}
            <Link to="/setup/access" data-testid={`staff-limits-${u.id}`} title="Limits & screen access (Access control)" className="ml-1 inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-500 hover:bg-canvas"><SlidersHorizontal size={11} /></Link>
          </Td>
        </tr>)}
        {!shown.length && <tr><Td colSpan={8} className="py-6 text-center text-xs text-ink-400">Nobody matches.</Td></tr>}
      </tbody></Table>
    </Card>
    {!owner && <p className="text-[11px] text-ink-400">Disable / enable is owner-only (MH) — managers create, invite and edit.</p>}
    {form && <StaffForm init={form} users={users} onClose={() => setForm(null)} onSaved={(u, created) => { setForm(null); reload(); onFlash(created ? `${u.shortName} created · invite code ${u.invite?.code} sent by ${u.invite?.channel} (MOCK — also in Sent)` : `${u.shortName} saved`); }} />}
    {account && <AccountModal user={account} onClose={() => setAccount(null)} onDone={(m) => { setAccount(null); reload(); onFlash(m); }} />}
  </div>;
};
