import { Pin, PinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Assignee, Division, PinnedItem, Role } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtTime } from '@/lib/format';
import { useEffect, useState } from 'react';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export const PinnedList = ({ items, onDismiss, dense }: { items: PinnedItem[]; onDismiss: (id: string) => void; dense?: boolean }) => (
  <ul data-testid="pinned-list" className="divide-y divide-amber-100">
    {items.map((p) => (
      <li key={p.id} data-testid={`pinned-${p.id}`} className={`flex items-center gap-3 bg-amber-50/40 px-4 ${dense ? 'py-1.5' : 'py-2.5'}`}>
        <Pin size={13} className="shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink">
            {p.jobId ? <Link to={`/jobs/${p.jobId}`} className="hover:underline">{p.title}</Link>
            : p.clientId ? <Link to={`/clients/${p.clientId}`} className="hover:underline">{p.title}</Link>
            : p.estimateId ? <Link to={`/estimates/${p.estimateId}`} className="hover:underline">{p.title}</Link>
            : p.title}
          </div>
          {!dense && <div className="text-[11px] text-ink-400">pinned by {p.createdBy} · {fmtTime(p.createdAt)} · {p.assignedTo.type === 'role' ? `role · ${p.assignedTo.role}` : 'for me'}{p.taskId && ' · from a task'}</div>}
        </div>
        {p.createdBy !== (p.assignedTo.type === 'user' ? p.assignedTo.shortName : '') && <OwnerChip owner={p.createdBy} />}
        <button type="button" data-testid={`pin-dismiss-${p.id}`} onClick={() => onDismiss(p.id)} title="Done — dismiss" className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-500 hover:bg-surface hover:text-ink"><PinOff size={11} /> Done</button>
      </li>
    ))}
  </ul>
);

/** Division-scoped assignee select — only shows staff and roles from the current session's division. */
export const AssigneeSelect = ({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId: string }) => {
  const { station } = useAuth();
  const div: Division = station?.division ?? 'rolliworks';
  const divStaff = api.getDivisionStaff(div);
  const divRoles = api.getDivisionRoles(div);
  return (
    <select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} block w-full`}>
      <optgroup label="People">
        {divStaff.map((u) => <option key={u.id} value={`user:${u.shortName}`}>{u.shortName}{u.division === 'both' ? ' (both)' : ''}</option>)}
      </optgroup>
      <optgroup label="Roles">
        {divRoles.map((r) => <option key={r} value={`role:${r}`}>{r} → {api.getDivisionStaff(div).filter((u) => u.roles.includes(r as Role)).map((u) => u.shortName).join(', ')}</option>)}
      </optgroup>
    </select>
  );
};

export const toAssignee = (v: string): Assignee => { const [t, x] = v.split(':'); return t === 'role' ? { type: 'role', role: x as Role } : { type: 'user', shortName: x }; };

export const PinForm = ({ onPinned, me }: { onPinned: () => void; me: string }) => {
  const [text, setText] = useState('');
  const [who, setWho] = useState(`user:${me}`);
  const [err, setErr] = useState<string | null>(null);

  // Sync the "For" select when a valid @mention or #mention is typed
  const { station } = useAuth();
  const div: Division = station?.division ?? 'rolliworks';
  const handleTextChange = (raw: string) => {
    setText(raw);
    const m = raw.trim().match(/^[#@](\w+)\s/);
    if (m) {
      const tag = m[1].toLowerCase();
      const u = api.getDivisionStaff(div).find((s) => s.shortName.toLowerCase() === tag || s.firstName.toLowerCase() === tag);
      if (u) { setWho(`user:${u.shortName}`); return; }
      const r = api.getDivisionRoles(div).find((role) => role.toLowerCase() === tag);
      if (r) { setWho(`role:${r}`); return; }
    }
  };

  const go = async () => {
    try { await api.pinToHitList({ title: text, assignedTo: toAssignee(who) }); setText(''); setErr(null); onPinned(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <div data-testid="pin-form" className="grid grid-cols-[1fr_200px_auto] items-end gap-2">
      <label className="text-xs text-ink-500">Add to hit list — freeform, or start with #name / @name / #role / @role<input data-testid="pin-title" value={text} onChange={(e) => handleTextChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} placeholder='e.g. "@vienna order paper" or "#manager sign off"' className={`${field} mt-1 block w-full`} /></label>
      <label className="text-xs text-ink-500">For<div className="mt-1"><AssigneeSelect value={who} onChange={setWho} testId="pin-assignee" /></div></label>
      <Button variant="primary" data-testid="pin-create" onClick={go}><Pin size={13} /> Pin</Button>
      {err && <p data-testid="pin-error" className="col-span-3 text-xs font-medium text-rose-700">{err}</p>}
    </div>
  );
};

export const PinModal = ({ defaultTitle, jobId, taskId, onClose, onPinned }: { defaultTitle: string; jobId?: string; taskId?: string; onClose: () => void; onPinned: () => void }) => {
  const { station } = useAuth();
  const div: Division = station?.division ?? 'rolliworks';
  const divStaff = api.getDivisionStaff(div);
  const defaultWho = divStaff.find((u) => u.shortName !== 'MH')?.shortName ?? divStaff[0]?.shortName ?? '';
  const [text, setText] = useState(defaultTitle);
  const [who, setWho] = useState(`user:${defaultWho}`);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    try { await api.pinToHitList({ title: text, assignedTo: toAssignee(who), jobId, taskId }); onPinned(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Modal onClose={onClose} testId="pin-modal" width="w-[480px]" title="Add to hit list">
      <div className="space-y-3 p-5">
        <label className="block text-xs text-ink-500">What<input data-testid="pin-modal-title" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} className={`${field} mt-1 block w-full`} /></label>
        <label className="block text-xs text-ink-500">Whose list (person or role)<div className="mt-1"><AssigneeSelect value={who} onChange={setWho} testId="pin-modal-assignee" /></div></label>
        <p className="text-[11px] text-ink-400">Shows in a Pinned section at the top of their Today, dismissible when done. Derived rows are never hidden by pins.</p>
        {err && <p data-testid="pin-modal-error" className="text-xs font-medium text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="pin-modal-confirm" onClick={go}><Pin size={13} /> Pin</Button></div>
      </div>
    </Modal>
  );
};

export const useInitialisedWho = (me: string) => {
  const [who, setWho] = useState(`user:${me}`);
  useEffect(() => {
    setWho(`user:${me}`);
  }, [me]);
  return { who, setWho };
};
