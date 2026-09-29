import { Flag } from 'lucide-react';
import * as api from '@/api/client';
import type { Assignee, Division, Role } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

// "Flag to" picker — person or role (#polisher / @JV — same mention pattern as Pinned). Value '' = don't flag.
export const flagAssignee = (v: string): Assignee | null => { if (!v) return null; const [t, x] = v.split(':'); return t === 'role' ? { type: 'role', role: x as Role } : t === 'station' ? { type: 'station', stationId: x } : { type: 'user', shortName: x }; };
export const FlagToPicker = ({ value, onChange, note, onNote, dark, testId = 'flag-to' }: { value: string; onChange: (v: string) => void; note: string; onNote: (v: string) => void; dark?: boolean; testId?: string }) => {
  const { station, user } = useAuth(); const div: Division = station?.division ?? 'rolliworks';
  const staff = api.getDivisionStaff(div).filter((u) => u.id !== user?.id); const roles = api.getDivisionRoles(div);
  const sel = dark ? 'h-11 rounded-2xl border border-white/15 bg-white/5 px-3 text-base text-white focus:outline-none' : 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
  return <div data-testid={testId} className={`flex flex-wrap items-center gap-2 ${dark ? 'text-slate-200' : 'text-xs text-ink-500'}`}>
    <span className="inline-flex items-center gap-1 font-medium"><Flag size={dark ? 16 : 12} /> Flag to</span>
    <select data-testid={`${testId}-select`} value={value} onChange={(e) => onChange(e.target.value)} className={sel}>
      <option value="">— nobody —</option>
      <optgroup label="People">{staff.map((u) => <option key={u.id} value={`user:${u.shortName}`}>@{u.shortName} · {u.dutyLabel}</option>)}</optgroup>
      <optgroup label="Roles">{roles.map((r) => <option key={r} value={`role:${r}`}>#{r}</option>)}</optgroup>
    </select>
    {value && <input data-testid={`${testId}-note`} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Note for their hitlist (optional)" className={`${sel} min-w-[220px] flex-1`} />}
  </div>;
};
