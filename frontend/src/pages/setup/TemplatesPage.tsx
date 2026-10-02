import clsx from 'clsx';
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, GripVertical, Pencil, Pin, PinOff, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { MessageTemplate, PersonalTemplate, TemplateCategory } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AttachmentThumbs, TemplateBadges } from '@/components/comms/TemplateBits';
import { TemplateForm } from '@/components/comms/TemplateForm';
import { field } from '@/components/rs/RsBits';
import { Button, PageHeader } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';

// Setup → Templates (manager tier): the ONE message_templates store — grouped by category, drag (or ▲▼) to reorder within a category, pin / unpin for MY row, create · edit · archive · restore.
export default function TemplatesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MessageTemplate[]>([]); const [variants, setVariants] = useState<PersonalTemplate[]>([]); const [pins, setPins] = useState<string[]>([]);
  const [q, setQ] = useState(''); const [archived, setArchived] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [creating, setCreating] = useState(false); const [flash, setFlash] = useState<string | null>(null); const [drag, setDrag] = useState<string | null>(null);
  const load = () => { void api.getTemplateLibrary({ includeArchived: true }).then(setRows); void api.getAllPersonalTemplates().then(setVariants); setPins(api.pinnedKeysSync()); };
  useEffect(load, []);
  useEffect(() => { window.addEventListener(api.TEMPLATES_CHANGED_EVENT, load); return () => window.removeEventListener(api.TEMPLATES_CHANGED_EVENT, load); }, []);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2500); };
  const act = async (f: () => Promise<unknown>, ok: string) => { try { await f(); say(ok); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } };
  const canPickDivision = api.isOwnerSync();
  const shown = useMemo(() => { const qq = q.trim().toLowerCase(); return rows.filter((t) => (archived || t.active !== false) && (!qq || `${t.name} ${t.subject} ${t.body} ${t.usedBy ?? ''}`.toLowerCase().includes(qq))); }, [rows, q, archived]);
  const pinned = pins.map((k) => rows.find((t) => t.key === k)).filter((t): t is MessageTemplate => !!t);
  if (user?.accessTier !== 'manager') return <div data-testid="templates-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Setup → Templates is owner / manager only. You can still save and pin your own templates from the reply composer.</div>;
  const move = async (cat: TemplateCategory, keys: string[], from: string, to: string) => { if (from === to) return; const next = keys.filter((k) => k !== from); next.splice(next.indexOf(to), 0, from); await api.reorderTemplates(cat, next); };
  const shift = async (cat: TemplateCategory, keys: string[], key: string, dir: -1 | 1) => { const i = keys.indexOf(key); const j = i + dir; if (j < 0 || j >= keys.length) return; const next = [...keys]; [next[i], next[j]] = [next[j], next[i]]; await api.reorderTemplates(cat, next); };
  return <div data-testid="templates-page" className="space-y-3">
    <PageHeader title="Setup → Templates" subtitle="One store for every message template — the Inbox composer, Estimate → Send and the system sends all read it. Drag (or ▲▼) to reorder inside a category · pins are per person, max 6." action={<div className="flex items-center gap-2"><Link to="/setup" data-testid="templates-back" className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><ArrowLeft size={12} /> Setup</Link><Button size="sm" variant="primary" data-testid="templates-page-new" onClick={() => { setCreating(true); setEditing(null); }}><Plus size={12} /> New template</Button></div>} />
    {flash && <div data-testid="templates-page-flash" className="rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-700">{flash}</div>}
    <section data-testid="pins-row" data-count={pinned.length} className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center gap-2 text-xs"><Pin size={12} className="text-amber-800" /><span className="font-semibold text-ink">My pinned row</span><span className="text-ink-500">· {pinned.length}/{api.MAX_TEMPLATE_PINS} · the chips above your reply box, in this order</span></div>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {pinned.map((t, i) => <li key={t.key} data-testid={`pin-item-${t.key}`} data-order={i} draggable onDragStart={() => setDrag(`pin:${t.key}`)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag?.startsWith('pin:')) { const from = drag.slice(4); const next = pins.filter((k) => k !== from); next.splice(next.indexOf(t.key), 0, from); void api.reorderPins(next); } setDrag(null); }} className="inline-flex h-7 cursor-grab items-center gap-1 rounded-full border border-amber-300 bg-surface pl-1.5 pr-1 text-[11px] font-medium text-amber-950 active:cursor-grabbing"><GripVertical size={11} className="text-amber-700" />{t.name}<button type="button" data-testid={`pin-left-${t.key}`} disabled={i === 0} onClick={() => { const next = [...pins]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; void api.reorderPins(next); }} aria-label="Move left" className="grid h-5 w-5 place-items-center rounded-full text-ink-500 hover:bg-amber-100 disabled:opacity-30">‹</button><button type="button" data-testid={`pin-right-${t.key}`} disabled={i === pinned.length - 1} onClick={() => { const next = [...pins]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; void api.reorderPins(next); }} aria-label="Move right" className="grid h-5 w-5 place-items-center rounded-full text-ink-500 hover:bg-amber-100 disabled:opacity-30">›</button><button type="button" data-testid={`pin-remove-${t.key}`} onClick={() => void act(() => api.pinTemplate(t.key, false), `Unpinned · ${t.name}`)} aria-label="Unpin" className="grid h-5 w-5 place-items-center rounded-full text-ink-500 hover:bg-amber-100 hover:text-rose-700"><X size={11} /></button></li>)}
        {!pinned.length && <li data-testid="pins-empty" className="text-[11px] text-ink-400">Nothing pinned yet — use the pin on any row below.</li>}
      </ol>
    </section>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <input data-testid="templates-page-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title · subject · body · where used" className={`${field} w-72`} />
      <label className="inline-flex items-center gap-1 text-ink-500"><input data-testid="templates-page-archived" type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> show archived</label>
      <span className="ml-auto text-[11px] text-ink-400">{rows.filter((t) => t.active !== false).length} active · {rows.filter((t) => t.active === false).length} archived · {variants.length} personal variant{variants.length === 1 ? '' : 's'}</span>
    </div>
    {creating && <TemplateForm testId="tplf-page-new" canPickDivision={canPickDivision} onCancel={() => setCreating(false)} onSave={async (input) => { const t = await api.createTemplate(input); setCreating(false); say(`Created · ${t.name}`); }} />}
    {api.TEMPLATE_CATEGORIES.map((c) => { const list = shown.filter((t) => (t.category ?? 'general') === c.key); const keys = list.map((t) => t.key); if (!list.length && q.trim()) return null; return <section key={c.key} data-testid={`tpl-section-${c.key}`} data-count={list.length} className="rounded-md border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{c.label}<span className="font-mono text-[10px] font-normal text-ink-400">{list.length}</span></div>
      <ol className="divide-y divide-line/70">
        {list.map((t, i) => { const isPinned = pins.includes(t.key); const full = pins.length >= api.MAX_TEMPLATE_PINS; const vs = variants.filter((v) => v.key === t.key); const dead = t.active === false; return <li key={t.key} data-testid={`tpl-row-${t.key}`} data-order={i} data-pinned={isPinned || undefined} data-archived={dead || undefined} draggable={!dead} onDragStart={() => setDrag(`tpl:${t.key}`)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag?.startsWith('tpl:')) void move(c.key, keys, drag.slice(4), t.key); setDrag(null); }} className={clsx('px-3 py-2 text-xs', dead && 'opacity-60', drag === `tpl:${t.key}` && 'bg-canvas')}>
          {editing === t.key ? <TemplateForm testId={`tplf-${t.key}`} initial={t} canPickDivision={canPickDivision} onCancel={() => setEditing(null)} onSave={async (input) => { await api.updateTemplate(t.key, input); setEditing(null); say(`Saved · ${input.name}`); }} /> : <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex flex-col items-center text-ink-300"><GripVertical size={12} className={dead ? 'opacity-30' : 'cursor-grab'} /><button type="button" data-testid={`tpl-up-${t.key}`} disabled={i === 0 || dead} onClick={() => void shift(c.key, keys, t.key, -1)} aria-label="Move up" className="text-ink-400 hover:text-ink disabled:opacity-20"><ArrowUp size={10} /></button><button type="button" data-testid={`tpl-down-${t.key}`} disabled={i === list.length - 1 || dead} onClick={() => void shift(c.key, keys, t.key, 1)} aria-label="Move down" className="text-ink-400 hover:text-ink disabled:opacity-20"><ArrowDown size={10} /></button></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5"><span className="text-[13px] font-semibold text-ink">{t.name}</span><TemplateBadges t={t} showDivision /><span className="ml-auto text-[10px] text-ink-400">{(t.usage ?? 0) > 0 ? `used ${t.usage}× · ` : ''}updated {fmtDate(t.at)} by {t.updatedBy}</span></div>
              <div className="text-ink-600">{t.subject}</div>
              {t.usedBy && <div className="text-[10px] text-ink-400">system send: {t.usedBy}</div>}
              <div className="mt-0.5 flex flex-wrap gap-1">{t.mergeFields.map((f) => <span key={f} className="rounded bg-canvas px-1 font-mono text-[10px] text-ink-500">{f}</span>)}</div>
              {t.attachments && t.attachments.length > 0 && <div className="mt-1.5"><AttachmentThumbs photos={t.attachments} testId={`tpl-att-${t.key}`} size="h-10 w-12" /></div>}
              {vs.length > 0 && <details data-testid={`template-variants-${t.key}`} className="mt-1 text-[11px]"><summary className="cursor-pointer text-amber-800">Variants ({vs.length}) · personal versions, read-only here</summary><ul className="mt-1 space-y-1">{vs.map((v) => <li key={v.owner} data-testid={`template-variant-${t.key}-${v.owner}`} className="rounded-sm border border-amber-200 bg-amber-50/60 p-2"><div className="font-medium text-amber-900">{v.owner}’s version <span className="font-normal text-ink-400">· {fmtDate(v.updatedAt)}</span></div><div className="text-ink-700">{v.subject}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] text-ink-500">{v.body}</pre></li>)}</ul></details>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!dead && <button type="button" data-testid={`tpl-pin-${t.key}`} aria-pressed={isPinned} disabled={!isPinned && full} title={isPinned ? 'Unpin from my row' : full ? `My row is full (${api.MAX_TEMPLATE_PINS})` : 'Pin to my row'} onClick={() => void act(() => api.pinTemplate(t.key, !isPinned), isPinned ? `Unpinned · ${t.name}` : `Pinned · ${t.name}`)} className={clsx('inline-flex h-7 items-center gap-1 rounded-sm border px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40', isPinned ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-line text-ink-600 hover:bg-canvas')}>{isPinned ? <PinOff size={11} /> : <Pin size={11} />}{isPinned ? 'Unpin' : 'Pin'}</button>}
              {!dead && <Button size="sm" variant="ghost" data-testid={`tpl-edit-${t.key}`} onClick={() => { setEditing(t.key); setCreating(false); }}><Pencil size={11} /> Edit</Button>}
              {dead ? <Button size="sm" variant="ghost" data-testid={`tpl-restore-${t.key}`} onClick={() => void act(() => api.archiveTemplate(t.key, false), `Restored · ${t.name}`)}><ArchiveRestore size={11} /> Restore</Button> : <Button size="sm" variant="ghost" data-testid={`tpl-archive-${t.key}`} onClick={() => void act(() => api.archiveTemplate(t.key, true), `Archived · ${t.name} — history kept`)}><Archive size={11} /> Archive</Button>}
            </div>
          </div>}
        </li>; })}
        {!list.length && <li className="px-3 py-3 text-[11px] text-ink-400">No templates in this category yet.</li>}
      </ol>
    </section>; })}
  </div>;
}
