import clsx from 'clsx';
import { Archive, ArchiveRestore, Check, CornerUpLeft, Pin, PinOff } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import * as api from '@/api/client';
import type { ConvLane, ConvTag, Conversation } from '@/api/client';

// Right-click (long-press on pad) menu for a thread or request row — TAG a person / "Update work order", PIN, MOVE (Quoted · Answered · back to All), ARCHIVE.
export type MenuPos = { x: number; y: number };
export interface ThreadMenuActions { tag: (tag: ConvTag, on: boolean) => void; pin?: (on: boolean) => void; move?: (lane: ConvLane | null) => void; archive?: () => void; unarchive?: () => void }
export const ThreadContextMenu = ({ pos, conv, actions, onClose, testId = 'thread-menu' }: { pos: MenuPos; conv: Pick<Conversation, 'tags' | 'pinned' | 'lane' | 'status'>; actions: ThreadMenuActions; onClose: () => void; testId?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const down = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); }; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('mousedown', down); window.addEventListener('touchstart', down); window.addEventListener('keydown', key); window.addEventListener('scroll', onClose, true); return () => { window.removeEventListener('mousedown', down); window.removeEventListener('touchstart', down); window.removeEventListener('keydown', key); window.removeEventListener('scroll', onClose, true); }; }, [onClose]);
  const tags = new Set(conv.tags ?? []); const archived = conv.status === 'closed';
  const left = Math.min(pos.x, window.innerWidth - 240); const top = Math.min(pos.y, window.innerHeight - 360);
  const Item = ({ onClick, children, testId: t, tone }: { onClick: () => void; children: ReactNode; testId: string; tone?: 'danger' }) => <button type="button" role="menuitem" data-testid={t} onClick={() => { onClick(); onClose(); }} className={clsx('flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-canvas', tone === 'danger' && 'text-rose-700')}>{children}</button>;
  return createPortal(<div ref={ref} role="menu" data-testid={testId} style={{ left, top }} className="fixed z-[90] w-[230px] rounded-md border border-line bg-surface p-1 shadow-pop animate-rise">
    <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Tag</div>
    {api.CONV_TAGS.map((t) => <Item key={t.key} testId={`${testId}-tag-${t.key}`} onClick={() => actions.tag(t.key, !tags.has(t.key))}><span className={clsx('inline-block h-2.5 w-2.5 rounded-full', t.dot)} /><span className={t.kind === 'status' ? 'text-amber-900' : ''}>{t.label}</span>{tags.has(t.key) && <Check size={12} className="ml-auto text-ink-500" />}</Item>)}
    {(actions.pin || actions.move || actions.archive || actions.unarchive) && <div className="my-1 h-px bg-line" />}
    {actions.pin && !archived && <Item testId={`${testId}-pin`} onClick={() => actions.pin!(!conv.pinned)}>{conv.pinned ? <PinOff size={12} /> : <Pin size={12} />}{conv.pinned ? 'Unpin' : 'Pin to top'}</Item>}
    {actions.move && !archived && <>
      <Item testId={`${testId}-move-quoted`} onClick={() => actions.move!(conv.lane === 'quoted' ? null : 'quoted')}><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />{conv.lane === 'quoted' ? 'Back to All (from Quoted)' : 'Move to Quoted'}</Item>
      <Item testId={`${testId}-move-answered`} onClick={() => actions.move!(conv.lane === 'answered' ? null : 'answered')}><span className="inline-block h-2.5 w-2.5 rounded-sm bg-moss-700" />{conv.lane === 'answered' ? 'Back to All (from Answered)' : 'Move to Answered'}</Item>
    </>}
    {actions.archive && !archived && <Item testId={`${testId}-archive`} onClick={actions.archive} tone="danger"><Archive size={12} /> Archive</Item>}
    {actions.unarchive && archived && <Item testId={`${testId}-unarchive`} onClick={actions.unarchive}><ArchiveRestore size={12} /> Un-archive → All</Item>}
    <div className="mt-1 flex items-center gap-1 border-t border-line px-2 pt-1 text-[10px] text-ink-400"><CornerUpLeft size={10} /> right-click · long-press on a pad</div>
  </div>, document.body);
};

// Open on right-click, or on a ~500 ms touch hold (pads)
export const useRowMenu = () => {
  const [menu, setMenu] = useState<{ id: string; pos: MenuPos } | null>(null); const timer = useRef<number | null>(null);
  const onContextMenu = (id: string) => (e: ReactMouseEvent) => { e.preventDefault(); e.stopPropagation(); setMenu({ id, pos: { x: e.clientX, y: e.clientY } }); };
  const onTouchStart = (id: string) => (e: ReactTouchEvent) => { const t = e.touches[0]; timer.current = window.setTimeout(() => setMenu({ id, pos: { x: t.clientX, y: t.clientY } }), 500); };
  const onTouchEnd = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  return { menu, close: () => setMenu(null), rowProps: (id: string) => ({ onContextMenu: onContextMenu(id), onTouchStart: onTouchStart(id), onTouchEnd, onTouchMove: onTouchEnd }) };
};

// Tag dots on a row (people colored · "Update work order" amber chip). Row size = a 6px dot, no letters, name on hover; md = the thread header chip with initials.
export const TagDots = ({ tags, testId, size = 'sm' }: { tags?: ConvTag[]; testId?: string; size?: 'sm' | 'md' }) => {
  if (!tags?.length) return null;
  return <span data-testid={testId} data-tags={tags.join(' ')} className="inline-flex items-center gap-1">
    {tags.map((k) => { const t = api.CONV_TAGS.find((x) => x.key === k)!; return t.kind === 'status' ? <span key={k} data-testid={`${testId}-${k}`} className="rounded-sm bg-amber-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">Update WO</span>
      : <span key={k} data-testid={`${testId}-${k}`} title={t.label} aria-label={t.label} className={clsx('inline-grid shrink-0 place-items-center rounded-full font-mono font-bold text-white', t.dot, size === 'md' ? 'h-5 w-5 text-[9px]' : 'h-1.5 w-1.5')}>{size === 'md' ? t.short : ''}</span>; })}
  </span>;
};
