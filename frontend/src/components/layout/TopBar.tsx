import { MonitorSmartphone, Plus, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { QUICK_ACTIONS } from '@/config/navigation';
import { GlobalSearch } from './GlobalSearch';
import { UserSwitcher } from './UserSwitcher';
import { useQuickAdd } from '@/components/today/QuickAddOverlay';

const DIVISION_LABEL: Record<string, string> = { rolliworks: 'Rolliworks', rollishop: 'RolliShop' };
const DIVISION_CLS: Record<string, string> = {
  rolliworks: 'bg-moss-50 text-moss-800 border-moss-300',
  rollishop:  'bg-amber-50 text-amber-800 border-amber-300',
};

export const TopBar = () => {
  const { user, station } = useAuth();
  const navigate = useNavigate();
  const { open: openQuickAdd } = useQuickAdd();
  const div = station?.division ?? 'rolliworks';

  return (
    <header data-testid="top-bar" className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <GlobalSearch />

      <div className="flex items-center gap-1" role="toolbar" aria-label="Quick actions">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              data-testid={`action-${a.key}`}
              onClick={() => navigate(a.path)}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 transition-[background-color,border-color] duration-150 hover:border-ink-300 hover:bg-canvas"
            >
              <Icon size={14} strokeWidth={1.9} className="text-ink-500" />
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2 pl-3">
        {/* Station + division badge */}
        <span
          data-testid="header-station"
          className="hidden items-center gap-1.5 rounded-sm border border-line bg-canvas px-2 py-1 text-[11px] font-medium text-ink-700 md:inline-flex"
          title="Station (device-bound)"
        >
          <MonitorSmartphone size={12} className="text-ink-400" />
          {station?.name}
          <span className={`rounded-sm border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DIVISION_CLS[div]}`}>
            {DIVISION_LABEL[div]}
          </span>
        </span>

        {/* Global quick-add */}
        <button
          type="button"
          data-testid="topbar-quickadd-btn"
          onClick={openQuickAdd}
          title="Quick-add hit-list item (Alt+T)"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-line bg-canvas text-ink-500 hover:border-ink-400 hover:text-ink"
        >
          <Plus size={14} />
        </button>

        <div className="flex items-center gap-2 text-right">
          <div className="hidden leading-tight lg:block">
            <div data-testid="current-user-name" className="text-xs font-semibold text-ink">
              {user!.displayName}
            </div>
            <div className="text-[11px] text-ink-400">
              Signed in · <span className="capitalize">{user!.accessTier}</span> tier
            </div>
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-brand">
            <UserRound size={14} />
          </span>
        </div>
        <UserSwitcher />
      </div>
    </header>
  );
};
