import clsx from 'clsx';
import { Check, Flag } from 'lucide-react';
import type { HitListItem } from '@/api/client';
import { OwnerChip } from '@/components/ui/Pills';
import { dueLabel } from '@/lib/format';

interface Props {
  item: HitListItem;
  onToggle: (id: string) => void;
  dense?: boolean;
}

export const HitListRow = ({ item, onToggle, dense }: Props) => (
  <li
    data-testid={`hit-item-${item.id}`}
    className={clsx(
      'group flex items-center gap-3 px-4 transition-colors duration-150 hover:bg-canvas/70',
      dense ? 'py-1.5' : 'py-2.5',
      item.done && 'opacity-60',
    )}
  >
    <label className="relative flex cursor-pointer items-center">
      <input
        type="checkbox"
        data-testid={`hit-item-${item.id}-checkbox`}
        checked={item.done}
        onChange={() => onToggle(item.id)}
        className="peer sr-only"
        aria-label={`Mark "${item.title}" ${item.done ? 'not done' : 'done'}`}
      />
      <span className="grid h-4 w-4 place-items-center rounded-[3px] border border-ink-300 bg-surface transition-colors duration-150 peer-checked:border-moss peer-checked:bg-moss peer-focus-visible:ring-2 peer-focus-visible:ring-moss/40">
        <Check size={11} strokeWidth={3} className={clsx('text-white transition-opacity', item.done ? 'opacity-100' : 'opacity-0')} />
      </span>
    </label>

    <div className="min-w-0 flex-1">
      <div className={clsx('truncate text-[13px] text-ink', item.done && 'line-through decoration-ink-300')} title={item.title}>
        {item.title}
      </div>
      {!dense && item.relatedRef && <div className="font-mono text-[11px] text-ink-400">{item.relatedRef}</div>}
    </div>

    {item.priority === 'high' && !item.done && <Flag size={12} className="shrink-0 text-rose-600" aria-label="High priority" />}
    <span className={clsx('tabular shrink-0 text-[11px]', item.done ? 'text-ink-300' : 'text-ink-400')}>{dueLabel(item.dueAt)}</span>
    <OwnerChip owner={item.ownerShortName} />
  </li>
);
