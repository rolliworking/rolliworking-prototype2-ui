import { MonitorSmartphone, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { QUICK_ACTIONS } from '@/config/navigation';
import { GlobalSearch } from './GlobalSearch';
import { UserSwitcher } from './UserSwitcher';

export const TopBar = () => {
  const { user, station } = useAuth();
  const navigate = useNavigate();

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
        <span
          data-testid="header-station"
          className="hidden items-center gap-1.5 rounded-sm border border-line bg-canvas px-2 py-1 text-[11px] font-medium text-ink-700 md:inline-flex"
          title="Station (device-bound)"
        >
          <MonitorSmartphone size={12} className="text-ink-400" /> {station?.name}
        </span>
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
