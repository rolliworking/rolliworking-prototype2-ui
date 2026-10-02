import clsx from 'clsx';
import { Archive, ArchiveRestore, Pencil, Pin, PinOff, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as api from '@/api/client';
import type { MessageTemplate, ReplyChannel, TemplateCategory } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { RightSheet } from '@/components/ui/RightSheet';
import { AttachmentThumbs, TemplateBadges } from './TemplateBits';
import { TemplateForm } from './TemplateForm';

// Templates slide-out (right, 1/3): categories · search · Use / Pin / Edit / Archive · attachment thumbnails. Filtered by the reply's channel (email / portal) — 'both' templates always show.
export const TemplatesSheet = ({ channel, onUse, onClose, initialCategory }: { channel?: ReplyChannel; onUse: (t: MessageTemplate) => void; onClose: () => void; initialCategory?: TemplateCategory }) => {
  const [rows, setRows] = useState<MessageTemplate[]>([]); const [pins, setPins] = useState<string[]>(api.pinnedKeysSync());
  const [q, setQ] = useState(''); const [cat, setCat] = useState<TemplateCategory | 'all'>(initialCategory ?? 'all'); const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); const [creating, setCreating] = useState(false); const [flash, setFlash] = useState<string | null>(null);
  const canPickDivision = api.isOwnerSync();
  const load = () => { void api.getTemplateLibrary({ channel, includeArchived: archived, clientOnly: true }).then(setRows); setPins(api.pinnedKeysSync()); };
  useEffect(load, [channel, archived]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener(api.TEMPLATES_CHANGED_EVENT, load); return () => window.removeEventListener(api.TEMPLATES_CHANGED_EVENT, load); }); // eslint-disable-line react-hooks/exhaustive-deps
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2200); };
  const act = async (f: () => Promise<unknown>, ok: string) => { try { await f(); say(ok); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } };
  const counts = useMemo(() => rows.reduce<Record<string, number>>((m, t) => { const k = t.category ?? 'general'; m[k] = (m[k] ?? 0) + 1; return m; }, {}), [rows]);
  const shown = useMemo(() => { const qq = q.trim().toLowerCase(); return rows.filter((t) => (cat === 'all' || (t.category ?? 'general') === cat) && (!qq || `${t.name} ${t.subject} ${t.body}`.toLowerCase().includes(qq))); }, [rows, cat, q]);
  const full = pins.length >= api.MAX_TEMPLATE_PINS;
  return <RightSheet testId="templates-sheet" kind={channel} onClose={onClose} title={<span className="inline-flex items-center gap-2">Templates{channel && <span data-testid="templates-sheet-channel" className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-semibold', channel === 'portal' ? 'bg-moss-50 text-moss-800' : 'bg-sky-50 text-sky-800')}>for {channel} replies</span>}<span className="text-[10px] font-normal text-ink-400">{rows.length} available</span></span>}>
    <div className="flex items-center gap-2">
      <label className="relative flex-1"><Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="templates-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title · subject · body" className={`${field} w-full pl-6`} /></label>
      <Button size="sm" data-testid="templates-new" aria-pressed={creating} onClick={() => { setCreating((v) => !v); setEditing(null); }}><Plus size={12} /> New</Button>
    </div>
    <div data-testid="templates-cats" className="flex flex-wrap gap-1 text-[11px]">
      <button type="button" data-testid="templates-cat-all" aria-pressed={cat === 'all'} onClick={() => setCat('all')} className={clsx('rounded-full border px-2 py-0.5 font-medium', cat === 'all' ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas')}>All <span className="opacity-60">{rows.length}</span></button>
      {api.TEMPLATE_CATEGORIES.map((c) => <button key={c.key} type="button" data-testid={`templates-cat-${c.key}`} aria-pressed={cat === c.key} onClick={() => setCat(c.key)} className={clsx('rounded-full border px-2 py-0.5 font-medium', cat === c.key ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas', !counts[c.key] && cat !== c.key && 'opacity-50')}>{c.label} <span className="opacity-60">{counts[c.key] ?? 0}</span></button>)}
      <label className="ml-auto inline-flex items-center gap-1 text-[10px] text-ink-500"><input data-testid="templates-show-archived" type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> archived</label>
    </div>
    <div className="flex items-center justify-between text-[10px] text-ink-400"><span data-testid="templates-pin-count">Pinned {pins.length}/{api.MAX_TEMPLATE_PINS} · pins are yours only · one tap on a chip inserts body + attachments</span>{flash && <span data-testid="templates-flash" className="font-medium text-moss-700">{flash}</span>}</div>
    {creating && <TemplateForm testId="tplf-new" canPickDivision={canPickDivision} onCancel={() => setCreating(false)} onSave={async (input) => { const t = await api.createTemplate(input); setCreating(false); setCat(t.category ?? 'all'); say(`Created · ${t.name}`); }} />}
    <ul data-testid="templates-list" data-count={shown.length} className="space-y-2">
      {shown.map((t) => { const pinned = pins.includes(t.key); const archivedRow = t.active === false; return <li key={t.key} data-testid={`template-card-${t.key}`} data-pinned={pinned || undefined} data-archived={archivedRow || undefined} className={clsx('rounded-md border bg-surface p-2.5', archivedRow ? 'border-line opacity-60' : 'border-line hover:border-ink-300')}>
        {editing === t.key ? <TemplateForm testId={`tplf-${t.key}`} initial={t} canPickDivision={canPickDivision} onCancel={() => setEditing(null)} onSave={async (input) => { await api.updateTemplate(t.key, input); setEditing(null); say(`Saved · ${input.name}`); }} /> : <>
          <div className="flex flex-wrap items-center gap-1.5"><span data-testid={`template-name-${t.key}`} className="text-[13px] font-semibold text-ink">{t.name}</span><TemplateBadges t={t} showDivision={canPickDivision} />{(t.usage ?? 0) > 0 && <span className="ml-auto text-[10px] text-ink-400">used {t.usage}×</span>}</div>
          <div className="mt-0.5 text-[11px] text-ink-600">{t.subject}</div>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] leading-4 text-ink-500">{t.body}</p>
          {t.attachments && t.attachments.length > 0 && <div className="mt-1.5"><AttachmentThumbs photos={t.attachments} testId={`template-att-${t.key}`} size="h-12 w-14" /></div>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!archivedRow && <Button size="sm" variant="primary" data-testid={`template-use-${t.key}`} onClick={() => onUse(t)}>Use</Button>}
            {!archivedRow && <button type="button" data-testid={`template-pin-${t.key}`} aria-pressed={pinned} disabled={!pinned && full} title={pinned ? 'Unpin from your row' : full ? `Pinned row is full (${api.MAX_TEMPLATE_PINS}) — unpin one first` : 'Pin to your row above the composer'} onClick={() => void act(() => api.pinTemplate(t.key, !pinned), pinned ? `Unpinned · ${t.name}` : `Pinned · ${t.name}`)} className={clsx('inline-flex h-7 items-center gap-1 rounded-sm border px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40', pinned ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-line text-ink-600 hover:bg-canvas')}>{pinned ? <PinOff size={11} /> : <Pin size={11} />} {pinned ? 'Unpin' : 'Pin'}</button>}
            {!archivedRow && <button type="button" data-testid={`template-edit-${t.key}`} onClick={() => { setEditing(t.key); setCreating(false); }} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line px-2 text-[11px] font-medium text-ink-600 hover:bg-canvas"><Pencil size={11} /> Edit</button>}
            <span className="ml-auto" />
            {archivedRow ? <button type="button" data-testid={`template-restore-${t.key}`} onClick={() => void act(() => api.archiveTemplate(t.key, false), `Restored · ${t.name}`)} className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] text-ink-500 hover:text-ink"><ArchiveRestore size={11} /> Restore</button>
              : <button type="button" data-testid={`template-archive-${t.key}`} onClick={() => void act(() => api.archiveTemplate(t.key, true), `Archived · ${t.name}`)} className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] text-ink-400 hover:text-rose-700"><Archive size={11} /> Archive</button>}
          </div>
        </>}
      </li>; })}
      {!shown.length && <li data-testid="templates-empty" className="rounded-md border border-dashed border-line p-4 text-center text-[11px] text-ink-400">No templates match{channel ? ` for ${channel} replies` : ''}.</li>}
    </ul>
  </RightSheet>;
};
