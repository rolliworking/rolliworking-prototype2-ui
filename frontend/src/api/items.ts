import type { DeptCode, EstimateLine } from './types';

// ---- Multi-item estimates — an ITEM is a separate physical piece (watch + bracelet, two watches); a LINE is work within one item ----
// An item has NO manually-picked flow: its dept posture is its W/B/P/PM chip row, inferred from its own lines. A hand toggle is an explicit, logged override.
export interface ComponentsOverride { by: string; at: string; from: DeptCode[] }
export interface EstimateItem { id: string; label: string; components?: DeptCode[]; componentsOverride?: ComponentsOverride }
let seq = 0;
export const newItem = (label = 'Watch'): EstimateItem => ({ id: `it-${Date.now().toString(36)}-${(seq += 1)}`, label });
// Numbering is positional — "Item 2 of 3" is derived from the array, so it re-flows on add/remove and never goes stale
export const itemNumber = (items: EstimateItem[], id: string) => items.findIndex((i) => i.id === id) + 1;
export const linesFor = (lines: EstimateLine[], items: EstimateItem[], itemId: string) => lines.filter((l) => (l.itemId ?? items[0]?.id) === itemId);
export const itemStatus = (lines: EstimateLine[], items: EstimateItem[], itemId: string): 'pending' | 'complete' => (linesFor(lines, items, itemId).some((l) => l.description.trim() || l.unitPrice) ? 'complete' : 'pending');
export const itemsProgress = (lines: EstimateLine[], items: EstimateItem[]) => items.filter((i) => itemStatus(lines, items, i.id) === 'complete').length;
// Removing an item drops its lines; ids stay stable so anything keyed to an item (custody, received flags) follows the item, not its old number
export const removeItem = (lines: EstimateLine[], items: EstimateItem[], id: string) => ({ items: items.filter((i) => i.id !== id), lines: lines.filter((l) => (l.itemId ?? items[0]?.id) !== id) });

const uniqCodes = (xs: DeptCode[]) => Array.from(new Set(xs));
// Inference reads ONLY this item's lines — Item 2's chips can never see Item 1's lines
export const inferItemCodes = (lines: EstimateLine[], items: EstimateItem[], itemId: string): DeptCode[] => uniqCodes(linesFor(lines, items, itemId).filter((l) => l.type !== 'shipping' && (l.description.trim() || l.unitPrice)).map((l) => l.dept));
export interface ItemCodes { codes: DeptCode[]; inferred: boolean; override?: ComponentsOverride }
export const itemCodes = (lines: EstimateLine[], items: EstimateItem[], item: EstimateItem): ItemCodes => (item.components?.length ? { codes: item.components, inferred: false, override: item.componentsOverride } : { codes: inferItemCodes(lines, items, item.id), inferred: true });
// Whole-job read model only (labels' workflow line, job dept badges) — never an input to any item-scoped screen
export const unionItemCodes = (lines: EstimateLine[], items: EstimateItem[]): DeptCode[] => uniqCodes(items.flatMap((i) => itemCodes(lines, items, i).codes));
