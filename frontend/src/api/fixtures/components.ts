import type { ComponentKey } from '../types';
import { daysAgo } from './time';

// Seeded component completions (MH ruling: per-component completion). Jobs not listed derive: done statuses → all complete; otherwise none.
export const componentSeeds: Record<string, { key: ComponentKey; by: string; at: string }[]> = {
  'j-03': [{ key: 'case', by: 'Walter', at: daysAgo(2, 15) }], // E02013 W+P — polish done, head still out → Awaiting components
  'j-06': [{ key: 'head', by: 'MM', at: daysAgo(1, 16) }], // E02016 W+PM — movement done, precious-metal work still out
  'j-16': [{ key: 'head', by: 'MM', at: daysAgo(4, 11) }, { key: 'case', by: 'Walter', at: daysAgo(3, 14) }], // E02026 in testing
  'j-05': [{ key: 'band', by: 'Walter', at: daysAgo(5, 10) }, { key: 'case', by: 'Walter', at: daysAgo(5, 16) }], // E02015 in testing
};
