import { Check, Package, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { EstimateLine } from '@/api/client';
import { ITEM_FLOWS, itemNumber, itemStatus, itemsProgress, type EstimateItem, type ItemFlow } from '@/api/items';

export const FlowTag = ({ flow, testId }: { flow: ItemFlow; testId?: string }) => <span data-testid={testId} className="inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">[{flow}] <span className="font-sans font-medium normal-case text-white/80">{ITEM_FLOWS[flow].label}</span></span>;

// "Add Additional Item" — a separate physical piece, deliberately distinct from "add line" (which is more work on the same piece)
export const AddItemButton = ({ onAdd, testId = 'add-item' }: { onAdd: (flow: ItemFlow) => void; testId?: string }) => {
  const [open, setOpen] = useState(false);
  return <span className="relative inline-flex">
    <button type="button" data-testid={testId} onClick={() => setOpen((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-dashed border-ink/50 bg-amber-50 px-3 text-xs font-semibold text-ink hover:bg-amber-100"><Package size={13} /> Add Additional Item <span className="font-normal text-ink-500">· separate physical piece</span></button>
    {open && <span data-testid={`${testId}-flows`} className="absolute left-0 top-10 z-20 w-64 rounded-md border border-line bg-surface p-1.5 shadow-lg">{(Object.keys(ITEM_FLOWS) as ItemFlow[]).map((f) => <button key={f} type="button" data-testid={`${testId}-flow-${f}`} onClick={() => { onAdd(f); setOpen(false); }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-canvas"><span className="font-mono font-bold">[{f}]</span><span><span className="font-medium text-ink">{ITEM_FLOWS[f].label}</span><span className="block text-[10px] text-ink-400">{ITEM_FLOWS[f].blurb}</span></span></button>)}</span>}
  </span>;
};

interface PanelProps { items: EstimateItem[]; lines: EstimateLine[]; selected: string; onSelect: (id: string) => void; onRemove?: (id: string) => void; onLabel?: (id: string, label: string) => void; received?: string[]; onToggleReceived?: (id: string, v: boolean) => void; title?: string; testId?: string }
// Multi-item partition — only rendered when there is genuinely more than one item to disambiguate
export const MultiItemPanel = ({ items, lines, selected, onSelect, onRemove, onLabel, received, onToggleReceived, title = 'Multi-item estimate', testId = 'multi-item' }: PanelProps) => {
  if (items.length < 2) return null;
  const done = received ? received.filter((id) => items.some((i) => i.id === id)).length : itemsProgress(lines, items);
  return <div data-testid={`${testId}-panel`} data-count={items.length} data-progress={done} className="rounded-md border border-line bg-canvas/60 p-3">
    <div className="mb-2 flex items-center gap-2 text-xs"><Package size={13} className="text-ink-500" /><span className="font-semibold text-ink">{title}</span><span className="text-ink-400">—</span><span data-testid={`${testId}-progress`} className="font-medium text-ink-700">Progress: {done} of {items.length}</span><span className="ml-auto text-[10px] text-ink-400">numbering re-flows automatically · lines never cross items</span></div>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map((it) => { const n = itemNumber(items, it.id); const isSel = it.id === selected; const st = received ? (received.includes(it.id) ? 'received' : 'pending') : itemStatus(lines, items, it.id); const count = lines.filter((l) => (l.itemId ?? items[0].id) === it.id && (l.description.trim() || l.unitPrice)).length;
        return <div key={it.id} data-testid={`${testId}-card-${n}`} data-item-id={it.id} data-status={isSel ? 'selected' : st} onClick={() => onSelect(it.id)} className={`cursor-pointer rounded-md border p-2 text-xs transition-colors ${isSel ? 'border-ink bg-surface ring-2 ring-ink/10' : 'border-line bg-surface/60 hover:border-ink-300'}`}>
          <div className="flex items-center gap-2"><span className="font-semibold text-ink">Item {n} of {items.length}</span><span className={`ml-auto rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isSel ? 'bg-ink text-white' : st === 'complete' || st === 'received' ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800'}`}>{isSel ? 'selected' : st}</span>{onRemove && items.length > 1 && <button type="button" data-testid={`${testId}-remove-${n}`} onClick={(e) => { e.stopPropagation(); onRemove(it.id); }} className="text-ink-300 hover:text-rose-600" title="Remove this item"><X size={12} /></button>}</div>
          <div className="mt-1"><FlowTag flow={it.flow} /></div>
          {onLabel ? <input data-testid={`${testId}-label-${n}`} value={it.label} onChange={(e) => onLabel(it.id, e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-1 h-7 w-full rounded-sm border border-line bg-canvas px-1.5 text-[11px] focus:border-ink focus:outline-none" /> : <div className="mt-1 truncate text-[11px] text-ink-600">{it.label}</div>}
          {!received && <div className="mt-1 text-[10px] text-ink-400">{count} line{count === 1 ? '' : 's'}</div>}
          {onToggleReceived && <button type="button" data-testid={`${testId}-receive-${n}`} onClick={(e) => { e.stopPropagation(); onToggleReceived(it.id, !received?.includes(it.id)); }} className={`mt-1.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded-sm border text-[11px] font-medium ${received?.includes(it.id) ? 'border-moss bg-moss text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300'}`}>{received?.includes(it.id) ? <><Check size={11} /> In hand</> : <><Plus size={11} /> Mark in hand</>}</button>}
        </div>; })}
    </div>
  </div>;
};
