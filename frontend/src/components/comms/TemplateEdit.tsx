import { Pencil, RotateCcw, Save, UserCheck } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { RenderedTemplate, TemplateKey } from '@/api/client';
import { Button } from '@/components/ui/Button';

export type SendMode = 'shop' | 'personal' | 'one_off';
export interface DraftMessage { subject: string; body: string; mode: SendMode; owner?: string }

// Badge: which version is about to go out
export const TemplateSourceBadge = ({ mode, owner, testId = 'tpl-source' }: { mode: SendMode; owner?: string; testId?: string }) => (
  <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${mode === 'personal' ? 'bg-amber-100 text-amber-900' : mode === 'one_off' ? 'bg-sky-100 text-sky-900' : 'bg-canvas text-ink-500'}`}>{mode === 'personal' ? <><UserCheck size={10} /> {owner}’s template</> : mode === 'one_off' ? 'edited for this send' : 'shop default'}</span>
);

// Point-of-use editing: Edit next to Send → change the body inline → "Just this send" or "Save as my template" (becomes the user's version for future sends)
export const TemplateEdit = ({ tkey, rendered, vals, draft, onDraft, onReload }: { tkey: TemplateKey; rendered: RenderedTemplate; vals: Record<string, string>; draft: DraftMessage; onDraft: (d: DraftMessage) => void; onReload: (shopDefault?: boolean) => Promise<void> }) => {
  const [editing, setEditing] = useState(false); const [subject, setSubject] = useState(draft.subject); const [body, setBody] = useState(draft.body); const [err, setErr] = useState<string | null>(null); const [saved, setSaved] = useState<string | null>(null);
  const open = () => { setSubject(draft.subject); setBody(draft.body); setEditing(true); setSaved(null); };
  const justThis = () => { onDraft({ subject, body, mode: 'one_off' }); setEditing(false); setSaved('Used for this send only — template untouched.'); };
  const saveMine = async () => { try { const p = await api.savePersonalTemplate(tkey, api.unrenderTemplate(subject, vals), api.unrenderTemplate(body, vals)); setEditing(false); setErr(null); setSaved(`Saved as ${p.owner}’s template — used automatically for your future sends.`); await onReload(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } };
  const removeMine = async () => { await api.deletePersonalTemplate(tkey); setSaved('Your version removed — back to the shop default.'); await onReload(true); };
  return <div data-testid="tpl-edit" className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <TemplateSourceBadge mode={draft.mode} owner={draft.owner ?? rendered.owner} />
      {!editing && <Button data-testid="tpl-edit-btn" onClick={open}><Pencil size={12} /> Edit</Button>}
      {!editing && rendered.source === 'personal' && <Button data-testid="tpl-use-shop" onClick={() => void onReload(true)} title="Preview the shop default instead"><RotateCcw size={12} /> Use shop default</Button>}
      {!editing && rendered.source === 'personal' && <button type="button" data-testid="tpl-remove-mine" onClick={() => void removeMine()} className="text-[11px] text-ink-400 hover:text-rose-700">Remove my version</button>}
      {!editing && rendered.source === 'shop' && api.personalTemplateFor(tkey) && <Button data-testid="tpl-use-mine" onClick={() => void onReload(false)}><UserCheck size={12} /> Use my template</Button>}
    </div>
    {editing && <div data-testid="tpl-editor" className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <label className="block text-xs text-ink-500">Subject<input data-testid="tpl-edit-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block h-8 w-full rounded-sm border border-line bg-surface px-2 text-[13px]" /></label>
      <label className="block text-xs text-ink-500">Body<textarea data-testid="tpl-edit-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 block w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-[13px] leading-5" /></label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-ink-400">“Save as my template” keeps names, watch and links as merge fields so it works for the next client too.</span>
        <div className="flex gap-2"><Button onClick={() => setEditing(false)}>Cancel</Button><Button data-testid="tpl-just-this" onClick={justThis}>Just this send</Button><Button variant="primary" data-testid="tpl-save-mine" onClick={() => void saveMine()}><Save size={12} /> Save as my template</Button></div>
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>}
    {saved && <p data-testid="tpl-saved-note" className="text-[11px] text-emerald-700">{saved}</p>}
  </div>;
};
