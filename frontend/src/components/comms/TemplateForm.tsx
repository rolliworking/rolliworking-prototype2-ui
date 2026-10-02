import { Save } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { Division, MessageTemplate, PackagePhoto, TemplateCategory, TemplateChannel, TemplateInput } from '@/api/client';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { AttachmentThumbs } from './TemplateBits';

// Create / edit a template — used inline by the picker sheet and the Setup → Templates page. Division is only editable for an owner who spans both divisions.
export const TemplateForm = ({ initial, canPickDivision, onSave, onCancel, testId = 'tplf' }: { initial?: MessageTemplate; canPickDivision: boolean; onSave: (input: TemplateInput) => Promise<void>; onCancel: () => void; testId?: string }) => {
  const [d, setD] = useState<TemplateInput>({ name: initial?.name ?? '', category: initial?.category ?? 'general', subject: initial?.subject ?? '', body: initial?.body ?? '', channel: initial?.channel ?? 'both', division: initial?.division ?? 'both', shared: initial?.shared ?? true, attachments: initial?.attachments ?? [] });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await onSave(d); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); setBusy(false); } };
  return <form data-testid={testId} onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-2 rounded-md border border-ink bg-surface p-3 text-xs">
    <div className="grid gap-2 md:grid-cols-[1fr_170px]">
      <label className="block text-ink-500">Title<input data-testid={`${testId}-name`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Type of bracelet?" className={`${field} mt-0.5 block w-full`} /></label>
      <label className="block text-ink-500">Category<select data-testid={`${testId}-category`} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as TemplateCategory })} className={`${field} mt-0.5 block w-full`}>{api.TEMPLATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="block text-ink-500">Channel<select data-testid={`${testId}-channel`} value={d.channel} onChange={(e) => setD({ ...d, channel: e.target.value as TemplateChannel })} className={`${field} mt-0.5 block`}><option value="both">email + portal</option><option value="email">email only</option><option value="portal">portal only</option></select></label>
      {canPickDivision && <label className="block text-ink-500">Division<select data-testid={`${testId}-division`} value={d.division} onChange={(e) => setD({ ...d, division: e.target.value as Division | 'both' })} className={`${field} mt-0.5 block`}><option value="both">both</option><option value="rolliworks">Rolliworks</option><option value="rollishop">RolliShop</option></select></label>}
      <label className="inline-flex items-center gap-1.5 pb-1 text-ink-600"><input data-testid={`${testId}-shared`} type="checkbox" checked={d.shared} onChange={(e) => setD({ ...d, shared: e.target.checked })} /> shared with the division</label>
    </div>
    <label className="block text-ink-500">Subject<input data-testid={`${testId}-subject`} value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} className={`${field} mt-0.5 block w-full`} /></label>
    <label className="block text-ink-500">Body<textarea data-testid={`${testId}-body`} rows={7} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} className={`${field} mt-0.5 block w-full leading-5`} /></label>
    <div className="flex flex-wrap gap-1">{api.MERGE_FIELDS.map((f) => <button key={f} type="button" data-testid={`${testId}-merge-${f.replace(/[{}]/g, '').replace(/\./g, '-')}`} onClick={() => setD({ ...d, body: `${d.body}${d.body.endsWith(' ') || !d.body ? '' : ' '}${f}` })} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-600 hover:bg-line">{f}</button>)}</div>
    <div>
      <div className="mb-1 text-ink-500">Attachments · go out with every use{d.attachments.some((p) => /PLACEHOLDER/i.test(p.fileName ?? '')) && <span className="ml-1 rounded-sm bg-amber-50 px-1 text-[10px] font-semibold text-amber-900">contains PLACEHOLDER images</span>}</div>
      <AttachmentThumbs photos={d.attachments} testId={`${testId}-att`} onRemove={(i) => setD({ ...d, attachments: d.attachments.filter((_, j) => j !== i) })} />
      <details className="mt-1 text-[11px]"><summary className="cursor-pointer text-brand">Add image</summary><div className="mt-1"><PhotoCapture onAdd={(p: PackagePhoto[]) => setD({ ...d, attachments: [...d.attachments, ...p] })} /></div></details>
    </div>
    {err && <p data-testid={`${testId}-error`} className="text-rose-700">{err}</p>}
    <div className="flex justify-end gap-2"><Button type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" data-testid={`${testId}-save`} disabled={busy}><Save size={12} /> {initial ? 'Save changes' : 'Create template'}</Button></div>
  </form>;
};
