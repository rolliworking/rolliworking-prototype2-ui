import { Check, Package, Plus, X } from 'lucide-react';
import type { EstimateLine } from '@/api/client';
import { itemNumber, itemStatus, itemsProgress, type EstimateItem } from '@/api/items';

// "Add Additional Item" — a separate physical piece, deliberately distinct from "add line" (which is more work on the same piece).
// No flow is picked here: the item's dept posture is its chip row, inferred from the lines staff add to it.
export const AddItemButton = ({ onAdd, testId = 'add-item' }: { onAdd: () => void; testId?: string }) => (
  <button type="button" data-testid={testId} onClick={onAdd} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-dashed border-ink/50 bg-amber-50 px-3 text-xs font-semibold text-ink hover:bg-amber-100"><Package size={13} /> Add Additional Item <span className="font-normal text-ink-500">· separate physical piece</span></button>
);

interface PanelProps { items: EstimateItem[]; lines: EstimateLine[]; selected: string; onSelect: (id: string) => void; received?: string[]; onToggleReceived?: (id: string, v: boolean) => void; title?: string; testId?: string }
// Item picker (Receive Watch) — only rendered when there is genuinely more than one item to disambiguate
export const MultiItemPanel = ({ items, lines, selected, onSelect, received, onToggleReceived, title = 'Multi-item estimate', testId = 'multi-item' }: PanelProps) => {
  if (items.length < 2) return null;
  const done = received ? received.filter((id) => items.some((i) => i.id === id)).length : itemsProgress(lines, items);
  return <div data-testid={`${testId}-panel`} data-count={items.length} data-progress={done} className="rounded-md border border-line bg-canvas/60 p-3">
    <div className="mb-2 flex items-center gap-2 text-xs"><Package size={13} className="text-ink-500" /><span className="font-semibold text-ink">{title}</span><span className="text-ink-400">—</span><span data-testid={`${testId}-progress`} className="font-medium text-ink-700">Progress: {done} of {items.length}</span><span className="ml-auto text-[10px] text-ink-400">numbering re-flows automatically · lines never cross items</span></div>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map((it) => { const n = itemNumber(items, it.id); const isSel = it.id === selected; const st = received ? (received.includes(it.id) ? 'received' : 'pending') : itemStatus(lines, items, it.id); const count = lines.filter((l) => (l.itemId ?? items[0].id) === it.id && (l.description.trim() || l.unitPrice)).length;
        return <div key={it.id} data-testid={`${testId}-card-${n}`} data-item-id={it.id} data-status={isSel ? 'selected' : st} onClick={() => onSelect(it.id)} className={`cursor-pointer rounded-md border p-2 text-xs transition-colors ${isSel ? 'border-ink bg-surface ring-2 ring-ink/10' : 'border-line bg-surface/60 hover:border-ink-300'}`}>
          <div className="flex items-center gap-2"><span className="font-semibold text-ink">Item {n} of {items.length}</span><span className={`ml-auto rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isSel ? 'bg-ink text-white' : st === 'complete' || st === 'received' ? 'bg-moss-50 text-moss-700' : 'bg-amber-50 text-amber-800'}`}>{isSel ? 'selected' : st}</span></div>
          <div className="mt-1 truncate text-[11px] text-ink-600">{it.label}</div>
          {!received && <div className="mt-1 text-[10px] text-ink-400">{count} line{count === 1 ? '' : 's'}</div>}
          {onToggleReceived && <button type="button" data-testid={`${testId}-receive-${n}`} onClick={(e) => { e.stopPropagation(); onToggleReceived(it.id, !received?.includes(it.id)); }} className={`mt-1.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded-sm border text-[11px] font-medium ${received?.includes(it.id) ? 'border-moss bg-moss text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300'}`}>{received?.includes(it.id) ? <><Check size={11} /> In hand</> : <><Plus size={11} /> Mark in hand</>}</button>}
        </div>; })}
    </div>
  </div>;
};

// Header row for a stacked item table — only rendered when there are 2+ items
export const ItemHeader = ({ items, item, onLabel, onRemove, testId }: { items: EstimateItem[]; item: EstimateItem; onLabel?: (label: string) => void; onRemove?: () => void; testId: string }) => {
  const n = itemNumber(items, item.id);
  return <div data-testid={`${testId}-header`} className="mb-2 flex items-center gap-2 border-b border-ink/70 pb-1.5">
    <span data-testid={`${testId}-number`} className="inline-flex h-6 items-center rounded-sm bg-ink px-2 font-mono text-[11px] font-bold text-white">Item {n} of {items.length}</span>
    {onLabel ? <input data-testid={`${testId}-label`} value={item.label} onChange={(e) => onLabel(e.target.value)} placeholder="What is this piece?" className="h-7 w-72 rounded-sm border border-line bg-canvas px-2 text-xs focus:border-ink focus:outline-none" /> : <span data-testid={`${testId}-label`} className="text-xs font-medium text-ink">{item.label}</span>}
    {onRemove && items.length > 1 && <button type="button" data-testid={`${testId}-remove`} onClick={onRemove} title="Remove this item (and its lines)" className="ml-auto inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-400 hover:bg-rose-50 hover:text-rose-700"><X size={12} /> Remove item</button>}
  </div>;
};
