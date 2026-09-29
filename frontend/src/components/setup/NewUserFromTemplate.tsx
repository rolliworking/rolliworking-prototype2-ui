import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { Division, User } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const field = 'mt-1 h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

// New user from template: copies tier + roles + limits + reports-to from the chosen user; reports-to is editable in the same dialog
export const NewUserFromTemplate = ({ users, onClose, onCreated }: { users: User[]; onClose: () => void; onCreated: (u: User) => void }) => {
  const templates = users.filter((u) => !u.disabled);
  const [templateId, setTemplateId] = useState(templates.find((u) => u.shortName === 'Leo')?.id ?? templates[0]?.id ?? '');
  const t = templates.find((u) => u.id === templateId);
  const [firstName, setFirstName] = useState(''); const [shortName, setShortName] = useState(''); const [dutyLabel, setDutyLabel] = useState(''); const [division, setDivision] = useState<Division | 'both'>('rolliworks'); const [reportsTo, setReportsTo] = useState<string | undefined>(undefined); const [err, setErr] = useState<string | null>(null);
  const effReportsTo = reportsTo ?? t?.reportsTo ?? '';
  const go = async () => { try { const u = await api.createUserFromTemplate({ templateId, firstName, shortName, dutyLabel, division, reportsTo: effReportsTo || undefined }); onCreated(u); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <Modal onClose={onClose} testId="new-user-modal" width="w-[560px]" title="New user from template">
    <div className="space-y-3 p-5 text-xs text-ink-500">
      <label className="block">Template — copies tier · roles · limits · reports-to
        <select data-testid="new-user-template" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setReportsTo(undefined); }} className={field}>{templates.map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel} · {u.accessTier}</option>)}</select>
      </label>
      {t && <div data-testid="new-user-template-summary" className="rounded-sm bg-canvas px-3 py-2 text-[11px]">Copies: tier <b>{t.accessTier}</b> · roles <b>{t.roles.join(', ')}</b> · {api.limitsOf(t).lockedStations.length} locked station{api.limitsOf(t).lockedStations.length === 1 ? '' : 's'} · {api.limitsOf(t).partsCategories.length ? api.limitsOf(t).partsCategories.join(', ') : 'all parts categories'} · pricing {api.limitsOf(t).pricing} · reports to <b>{api.managerOf(t.id)?.shortName ?? '—'}</b></div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">First name (sign-in)<input data-testid="new-user-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. priya" className={field} /></label>
        <label className="block">Short name<input data-testid="new-user-short" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. PR" className={field} /></label>
        <label className="block">Duty label<input data-testid="new-user-duty" value={dutyLabel} onChange={(e) => setDutyLabel(e.target.value)} placeholder={t?.dutyLabel ?? ''} className={field} /></label>
        <label className="block">Division<select data-testid="new-user-division" value={division} onChange={(e) => setDivision(e.target.value as Division | 'both')} className={field}><option value="rolliworks">rolliworks</option><option value="rollishop">rollishop</option><option value="both">both</option></select></label>
      </div>
      <label className="block">Reports to (editable — defaults to the template's manager)
        <select data-testid="new-user-reports-to" value={effReportsTo} onChange={(e) => setReportsTo(e.target.value)} className={field}><option value="">— nobody</option>{templates.map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel}</option>)}</select>
      </label>
      <p className="text-[11px] text-ink-400">Password defaults to <span className="font-mono">firstname123</span>, PIN <span className="font-mono">1234</span> (prototype). Logged to the access change log.</p>
      {err && <p data-testid="new-user-error" className="font-medium text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="new-user-create" onClick={go}><UserPlus size={13} /> Create user</Button></div>
    </div>
  </Modal>;
};
