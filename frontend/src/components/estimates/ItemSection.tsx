import type { DeptCode, EstimateLine } from '@/api/client';
import { itemCodes, itemNumber, linesFor, type EstimateItem } from '@/api/items';
import { ComponentCodeChips } from './ComponentChain';
import { LineEditor } from './LineEditor';
import { ItemHeader } from './MultiItemBits';

type EditorProps = Omit<Parameters<typeof LineEditor>[0], 'lines' | 'onChange'>;
interface Props extends EditorProps {
  items: EstimateItem[]; item: EstimateItem; lines: EstimateLine[];
  onLines?: (itemLines: EstimateLine[]) => void;
  onLabel?: (label: string) => void; onRemove?: () => void;
  onToggleCode?: (next: DeptCode[]) => void; onRevertCodes?: () => void; chipsReadOnly?: boolean;
}
// One complete unit per physical item: [Item N of M header] → W/B/P/PM chip row (inferred from THIS item's lines) → this item's Lines table
export const ItemSection = ({ items, item, lines, onLines, onLabel, onRemove, onToggleCode, onRevertCodes, chipsReadOnly, ...editor }: Props) => {
  const n = itemNumber(items, item.id); const multi = items.length > 1; const testId = `item-${n}`;
  const ic = itemCodes(lines, items, item); const mine = linesFor(lines, items, item.id);
  return <section data-testid={testId} data-item-id={item.id} data-codes={ic.codes.join('+')} className={multi ? 'rounded-md border border-line bg-surface p-3' : ''}>
    {multi && <ItemHeader items={items} item={item} onLabel={onLabel} onRemove={onRemove} testId={testId} />}
    <div className="mb-3 rounded-md border border-line bg-canvas/60 p-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Component codes · what we expect in the box{multi ? ` for item ${n}` : ''}</div>
      <ComponentCodeChips value={ic.codes} inferred={ic.inferred} override={ic.override} readOnly={chipsReadOnly || !onToggleCode} onToggle={(c) => onToggleCode?.(ic.codes.includes(c) ? ic.codes.filter((x) => x !== c) : [...ic.codes, c])} onRevert={onRevertCodes} testId={`${testId}-chips`} />
    </div>
    <LineEditor {...editor} lines={mine} onChange={(ls) => onLines?.(ls)} />
  </section>;
};
