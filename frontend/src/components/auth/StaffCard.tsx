import clsx from 'clsx';
import { Check, KeyRound, UserRound } from 'lucide-react';
import type { User } from '@/api/client';

interface Props {
  user: User;
  selected: boolean;
  signedInToday: boolean;
  onSelect: (u: User) => void;
}

export const StaffCard = ({ user, selected, signedInToday, onSelect }: Props) => (
  <button
    type="button"
    data-testid={`staff-card-${user.firstName}`}
    onClick={() => onSelect(user)}
    aria-pressed={selected}
    className={clsx(
      'group flex w-full items-center gap-3 rounded-md border bg-surface p-3.5 text-left shadow-card transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-pop',
      selected ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink-300',
    )}
  >
    <span
      className={clsx(
        'grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition-colors',
        selected ? 'bg-ink text-white' : 'bg-brand-50 text-brand group-hover:bg-brand-100',
      )}
    >
      {user.shortName.length <= 2 ? user.shortName : <UserRound size={16} />}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-semibold text-ink">{user.displayName}</span>
      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
        <span className="capitalize">{user.accessTier} tier</span>
        {signedInToday ? (
          <span data-testid={`staff-card-${user.firstName}-pin-badge`} className="inline-flex items-center gap-1 rounded-sm bg-moss-50 px-1.5 py-0.5 font-medium text-moss-700">
            <Check size={10} strokeWidth={3} /> In today · PIN
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-sm bg-canvas px-1.5 py-0.5 text-ink-400">
            <KeyRound size={10} /> Password + photo
          </span>
        )}
      </span>
    </span>
  </button>
);
