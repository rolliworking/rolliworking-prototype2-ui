import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { navForTier, type NavItem } from '@/config/navigation';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Hammer } from 'lucide-react';

export const Sidebar = () => {
  const { user } = useAuth();
  const all = navForTier(user!.accessTier); const { pathname } = useLocation();
  const rw = all.filter((i) => i.group === 'rw'); const rwActive = rw.some((i) => pathname.startsWith(i.path)); const [rwOpen, setRwOpen] = useState(rwActive);
  // RW-specific screens nest under one 'RW' entry so the sidebar doesn't sprawl; the group renders where the first RW item used to sit
  const items: (NavItem | { key: 'rw-group' })[] = []; all.forEach((i) => { if (i.group === 'rw') { if (!items.some((x) => x.key === 'rw-group')) items.push({ key: 'rw-group' }); } else items.push(i); });

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
            if (!('path' in item)) return <li key="rw-group" data-testid="nav-rw-group"><button type="button" data-testid="nav-rw-toggle" aria-expanded={rwOpen} onClick={() => setRwOpen(!rwOpen)} className={clsx('group flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors', rwActive ? 'text-white' : 'hover:bg-white/[0.06] hover:text-white')}><Hammer size={15} strokeWidth={1.9} className="shrink-0 text-[#93a1b4] group-hover:text-white" /><span className="truncate">RW</span><span className="ml-auto text-[10px] text-[#8b98aa]">{rw.length}</span>{rwOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
              {rwOpen && <ul data-testid="nav-rw-items" className="ml-3 border-l border-white/10 pl-1">{rw.map((r) => { const RIcon = r.icon; return <li key={r.key}><NavLink to={r.path} data-testid={`nav-${r.key}`} className={({ isActive }) => clsx('flex h-7 items-center gap-2 rounded-sm px-2 text-[12px]', isActive ? 'bg-white/10 text-white' : 'hover:bg-white/[0.06] hover:text-white')}><RIcon size={13} className="shrink-0 text-[#93a1b4]" />{r.label}</NavLink></li>; })}</ul>}</li>;
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
