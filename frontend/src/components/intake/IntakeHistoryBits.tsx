import { X } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { DeptCode, IntakeHistoryRow } from '@/api/client';
import { ComponentCodeChips } from '@/components/estimates/ComponentChain';
import { Button } from '@/components/ui/Button';

const field = 'mt-1 block h-9 w-full rounded-sm border border-line bg-canvas px-2.5 font-mono text-[13px] focus:border-ink focus:bg-surface focus:outline-none';

// Post-hoc correction of a received watch's intake details — every save is audit-stamped with what changed
export const IntakeEditDialog = ({ row, onClose, onSaved }: { row: IntakeHistoryRow; onClose: () => void; onSaved: () => void }) => {
  const w = row.pkg.estimate?.watch;
  const [reference, setReference] = useState(w?.reference ?? ''); const [serial, setSerial] = useState(w?.serial ?? ''); const [itemLabel, setItemLabel] = useState(row.pkg.itemLabel ?? ''); const [notes, setNotes] = useState(row.pkg.notes ?? '');
  const [targetDate, setTargetDate] = useState(row.pkg.targetDate ?? ''); const [targetWeeks, setTargetWeeks] = useState(row.pkg.targetWeeks ?? 6);
  const [workflow, setWorkflow] = useState<DeptCode[]>(row.pkg.workflow ?? []); const [components, setComponents] = useState<string[]>(row.pkg.componentsVerified ?? []);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const options = Array.from(new Set([...api.uniqComponents(workflow), ...components, ...row.pkg.contents]));
  const save = async () => { setBusy(true); setError(null); try { await api.updateIntakeRecord(row.pkg.id, { reference, serial, itemLabel, notes, componentsVerified: components, workflow, targetDate: targetDate || undefined, targetWeeks }); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); } };
  return <div data-testid="intake-edit-dialog" className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
    <div className="w-[640px] max-h-[90vh] overflow-y-auto rounded-md bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-start justify-between"><div><div className="text-sm font-semibold text-ink">Edit intake details · {row.pkg.estimate?.number}</div><div className="text-xs text-ink-500">{row.pkg.subNumber} · {w?.brand} {w?.model} · corrections are audit-stamped; unprinted labels follow the change</div></div><button data-testid="intake-edit-close" onClick={onClose} className="text-ink-400 hover:text-ink"><X size={16} /></button></div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="text-ink-500">Reference<input data-testid="intake-edit-reference" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} className={field} /></label>
        <label className="text-ink-500">Serial #<input data-testid="intake-edit-serial" value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} className={field} /></label>
        <label className="col-span-2 text-ink-500">Item label (shop-floor badge)<input data-testid="intake-edit-item-label" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder="e.g. 1/3 · Submariner head" className={field} /></label>
        <label className="text-ink-500">Target completion date<input type="date" data-testid="intake-edit-target-date" value={targetDate} onChange={(e) => { setTargetDate(e.target.value); if (row.pkg.inspectedAt && e.target.value) setTargetWeeks(Math.max(1, Math.round((new Date(e.target.value).getTime() - new Date(row.pkg.inspectedAt).getTime()) / (7 * 864e5)))); }} className={field} /></label>
        <label className="text-ink-500">Target weeks<input type="number" min={1} data-testid="intake-edit-target-weeks" value={targetWeeks} onChange={(e) => setTargetWeeks(Number(e.target.value) || 1)} className={field} /></label>
        <label className="col-span-2 text-ink-500">Notes<textarea data-testid="intake-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none" /></label>
        <div className="col-span-2 text-ink-500">Component codes<div className="mt-1"><ComponentCodeChips value={workflow} onToggle={(c) => setWorkflow((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} testId="intake-edit-chips" /></div></div>
        <div className="col-span-2 text-ink-500">Components verified in hand<div className="mt-1 flex flex-wrap gap-1.5" data-testid="intake-edit-components">{options.map((c) => { const on = components.includes(c); return <button key={c} type="button" data-testid={`intake-edit-component-${c.replace(/\s+/g, '-')}`} aria-pressed={on} onClick={() => setComponents((v) => (on ? v.filter((x) => x !== c) : [...v, c]))} className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${on ? 'border-moss bg-moss text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300'}`}>{c}</button>; })}</div></div>
      </div>
      {error && <p data-testid="intake-edit-error" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button data-testid="intake-edit-cancel" onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="intake-edit-save" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save changes'}</Button></div>
    </div>
  </div>;
};
