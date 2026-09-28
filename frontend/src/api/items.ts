import type { EstimateLine } from './types';

// ---- Multi-item estimates — an ITEM is a separate physical piece (watch + bracelet, two watches); a LINE is work within one item ----
export type ItemFlow = 'W' | 'B' | 'H' | 'O';
export const ITEM_FLOWS: Record<ItemFlow, { label: string; blurb: string }> = {
  W: { label: 'full watch service flow', blurb: 'Complete watch — head + band' },
  B: { label: 'band only flow', blurb: 'Bracelet / strap on its own' },
  H: { label: 'head only flow', blurb: 'Watch head without band' },
  O: { label: 'other item', blurb: 'Box, papers, accessory, second piece' },
};
export interface EstimateItem { id: string; flow: ItemFlow; label: string }
let seq = 0;
export const newItem = (flow: ItemFlow = 'W', label?: string): EstimateItem => ({ id: `it-${Date.now().toString(36)}-${(seq += 1)}`, flow, label: label ?? ITEM_FLOWS[flow].blurb });
// Numbering is positional — "Item 2 of 3" is derived from the array, so it re-flows on add/remove and never goes stale
export const itemNumber = (items: EstimateItem[], id: string) => items.findIndex((i) => i.id === id) + 1;
export const linesFor = (lines: EstimateLine[], items: EstimateItem[], itemId: string) => lines.filter((l) => (l.itemId ?? items[0]?.id) === itemId);
export const itemStatus = (lines: EstimateLine[], items: EstimateItem[], itemId: string): 'pending' | 'complete' => (linesFor(lines, items, itemId).some((l) => l.description.trim() || l.unitPrice) ? 'complete' : 'pending');
export const itemsProgress = (lines: EstimateLine[], items: EstimateItem[]) => items.filter((i) => itemStatus(lines, items, i.id) === 'complete').length;
// Removing an item drops its lines; ids stay stable so anything keyed to an item (custody, received flags) follows the item, not its old number
export const removeItem = (lines: EstimateLine[], items: EstimateItem[], id: string) => ({ items: items.filter((i) => i.id !== id), lines: lines.filter((l) => (l.itemId ?? items[0]?.id) !== id) });
