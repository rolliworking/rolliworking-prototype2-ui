import clsx from 'clsx';
import { BookTemplate, Paperclip, Pin, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { MessageTemplate, PackagePhoto, ReplyChannel, TemplateCategory, TemplateChannel, TemplateKey } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AttachmentThumbs } from './TemplateBits';
import { TemplatesSheet } from './TemplatesSheet';

export interface ComposerDraft { subject: string; text: string; photos: PackagePhoto[] }

// Pinned row (max 6 chips, per user) + "Templates" button (slide-out) + "Save as template" for the reply just written. Shared by the Inbox composer and Estimate → Send.
export const TemplateBar = ({ channel, active, ctx, draft, onUse, onSaved, initialCategory, testId = 'composer' }: { channel: ReplyChannel; active?: TemplateKey | ''; ctx: { conversationId?: string; estimateId?: string }; draft?: ComposerDraft; onUse: (t: MessageTemplate) => void; onSaved?: (t: MessageTemplate) => void; initialCategory?: TemplateCategory; testId?: string }) => {
  const [pins, setPins] = useState<MessageTemplate[]>([]); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const load = () => { void api.getPinnedTemplates(channel).then(setPins); };
  useEffect(load, [channel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener(api.TEMPLATES_CHANGED_EVENT, load); return () => window.removeEventListener(api.TEMPLATES_CHANGED_EVENT, load); }); // eslint-disable-line react-hooks/exhaustive-deps
  const canSave = !!draft && draft.text.trim().length > 0;
  return <div data-testid={`${testId}-pins`} data-count={pins.length} className="flex flex-wrap items-center gap-1.5 text-[11px]">
    <Pin size={11} className="text-ink-400" />
    {pins.map((t) => <button key={t.key} type="button" data-testid={`pin-chip-${t.key}`} aria-pressed={active === t.key} title={`${t.subject}${t.attachments?.length ? ` · ${t.attachments.length} attachment${t.attachments.length === 1 ? '' : 's'}` : ''}`} onClick={() => onUse(t)} className={clsx('inline-flex h-6 max-w-[200px] items-center gap-1 truncate rounded-full border px-2.5 font-medium transition-colors', active === t.key ? 'border-ink bg-ink text-white' : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100')}><span className="truncate">{t.name}</span>{t.attachments && t.attachments.length > 0 && <Paperclip size={9} className="shrink-0 opacity-70" />}</button>)}
    {!pins.length && <span data-testid={`${testId}-pins-empty`} className="text-ink-400">No pinned templates yet — pin up to {api.MAX_TEMPLATE_PINS} from Templates</span>}
    <button type="button" data-testid={`${testId}-templates-open`} aria-pressed={open} onClick={() => setOpen(true)} className={clsx('inline-flex h-6 items-center gap-1 rounded-sm border px-2 font-semibold', open ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:bg-canvas')}><BookTemplate size={11} /> Templates</button>
    {canSave && <button type="button" data-testid={`${testId}-save-template`} onClick={() => setSaving(true)} title="Save what you just wrote as a template — names, watch and links become merge fields" className="inline-flex h-6 items-center gap-1 rounded-sm border border-line px-2 font-medium text-ink-600 hover:bg-canvas"><Save size={11} /> Save as template</button>}
    {open && <TemplatesSheet channel={channel} initialCategory={initialCategory} onClose={() => setOpen(false)} onUse={(t) => { onUse(t); setOpen(false); }} />}
    {saving && draft && <SaveAsTemplateModal channel={channel} ctx={ctx} draft={draft} initialCategory={initialCategory} onClose={() => setSaving(false)} onSaved={(t) => { setSaving(false); onSaved?.(t); }} />}
  </div>;
};

// Title + category prompt; body + attachments carried over from the composer. Preview shows the de-rendered text (merge fields back in place).
const SaveAsTemplateModal = ({ channel, ctx, draft, initialCategory, onClose, onSaved }: { channel: ReplyChannel; ctx: { conversationId?: string; estimateId?: string }; draft: ComposerDraft; initialCategory?: TemplateCategory; onClose: () => void; onSaved: (t: MessageTemplate) => void }) => {
  const [name, setName] = useState(''); const [category, setCategory] = useState<TemplateCategory>(initialCategory ?? 'general'); const [tch, setTch] = useState<TemplateChannel>(channel); const [shared, setShared] = useState(true); const [pin, setPin] = useState(api.pinnedKeysSync().length < api.MAX_TEMPLATE_PINS);
  const [preview, setPreview] = useState<string>(draft.text); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (ctx.conversationId) void api.mergeValuesForConversation(ctx.conversationId).then((vals) => setPreview(api.unrenderTemplate(draft.text, vals))); }, [ctx.conversationId, draft.text]);
  const save = async () => { try { const t = await api.saveDraftAsTemplate(ctx, { name, category, subject: draft.subject, text: draft.text, photos: draft.photos, channel: tch, shared }); if (pin) await api.pinTemplate(t.key, true).catch(() => undefined); onSaved(t); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } };
  return <Modal testId="save-template-modal" title="Save as template" width="w-[560px]" onClose={onClose}>
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-[1fr_170px] gap-2">
        <label className="block text-ink-500">Title<input data-testid="save-template-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clasp photo request" className={`${field} mt-0.5 block w-full`} /></label>
        <label className="block text-ink-500">Category<select data-testid="save-template-category" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} className={`${field} mt-0.5 block w-full`}>{api.TEMPLATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="block text-ink-500">Channel<select data-testid="save-template-channel" value={tch} onChange={(e) => setTch(e.target.value as TemplateChannel)} className={`${field} ml-1`}><option value="both">email + portal</option><option value="email">email only</option><option value="portal">portal only</option></select></label>
        <label className="inline-flex items-center gap-1.5 text-ink-600"><input data-testid="save-template-shared" type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> shared with the division</label>
        <label className="inline-flex items-center gap-1.5 text-ink-600"><input data-testid="save-template-pin" type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> pin it</label>
      </div>
      <div className="rounded-md border border-line bg-canvas/60 p-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Body as it will be saved · merge fields restored</div>
        <pre data-testid="save-template-preview" className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-4 text-ink-700">{preview}</pre>
        {draft.photos.length > 0 && <div className="mt-2"><div className="mb-1 text-[10px] text-ink-500">{draft.photos.length} attachment{draft.photos.length === 1 ? '' : 's'} carried over</div><AttachmentThumbs photos={draft.photos} testId="save-template-att" size="h-10 w-12" /></div>}
      </div>
      {err && <p data-testid="save-template-error" className="text-rose-700">{err}</p>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="save-template-confirm" onClick={() => void save()}><Save size={12} /> Save template</Button></div>
    </div>
  </Modal>;
};
