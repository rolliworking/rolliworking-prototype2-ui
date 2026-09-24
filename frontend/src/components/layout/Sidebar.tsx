import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { navForTier } from '@/config/navigation';

export const Sidebar = () => {
  const { user } = useAuth();
  const items = navForTier(user!.accessTier);

  return (
    <aside data-testid="sidebar" className="flex w-[216px] shrink-0 flex-col bg-ink text-[#c7d0dc]">
      <div className="flex h-12 items-center gap-2 px-4">
        <span className="grid h-6 w-6 place-items-center rounded-sm bg-white/10 font-mono text-[11px] font-semibold text-white">
          RS
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-white">RolliSuite</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Primary">
        <ul className="space-y-px">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className={clsx(item.pinned && 'mb-2')}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  data-testid={`nav-${item.key}`}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-150',
                      item.pinned && 'bg-moss/20 text-white ring-1 ring-inset ring-moss/60 hover:bg-moss/30',
                      !item.pinned && (isActive ? 'bg-white/10 text-white' : 'hover:bg-white/[0.06] hover:text-white'),
                      isActive && !item.pinned && 'before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-r before:bg-white',
                      isActive && item.pinned && 'bg-moss/40',
                    )
                  }
                >
                  <Icon size={15} strokeWidth={1.9} className={clsx('shrink-0', item.pinned ? 'text-moss-100' : 'text-[#93a1b4] group-hover:text-white')} />
                  <span className="truncate">{item.label}</span>
                  {item.pinned && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-moss-100" aria-hidden />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-[#8b98aa]">
        <div className="font-medium text-[#c7d0dc]">Access tier</div>
        <div data-testid="sidebar-tier" className="capitalize">{user!.accessTier}</div>
      </div>
    </aside>
  );
};
