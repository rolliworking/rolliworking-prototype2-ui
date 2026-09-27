import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { NAV_GROUPS, navForTier, type NavGroup, type NavItem } from '@/config/navigation';

const rowCls = (active: boolean) => clsx('group relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-150', active ? 'bg-white/10 text-white' : 'hover:bg-white/[0.06] hover:text-white');
const childCls = ({ isActive }: { isActive: boolean }) => clsx('flex h-7 items-center gap-2 rounded-sm px-2 text-[12px]', isActive ? 'bg-white/10 text-white' : 'hover:bg-white/[0.06] hover:text-white');

// Expandable group: header is a page when the group has a path (Intake, Clients) or a plain folder (RW); children indent underneath.
const Group = ({ g, items, pathname }: { g: NavGroup; items: NavItem[]; pathname: string }) => {
  const children = items.filter((i) => i.path !== g.path); const active = items.some((i) => pathname === i.path || pathname.startsWith(i.path + '/')); const [open, setOpen] = useState(active); const Icon = g.icon;
  const inner = <><Icon size={15} strokeWidth={1.9} className="shrink-0 text-[#93a1b4] group-hover:text-white" /><span className="truncate">{g.label}</span><span className="ml-auto text-[10px] text-[#8b98aa]">{children.length}</span></>;
  const toggle = <button type="button" data-testid={`nav-${g.key}-toggle`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${g.label}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }} className="grid h-6 w-6 place-items-center rounded-sm hover:bg-white/10">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>;
  return <li data-testid={`nav-${g.key}-group`}>
    {g.path ? <NavLink to={g.path} end data-testid={`nav-${g.key}`} className={({ isActive }) => clsx(rowCls(isActive || (active && !open)), isActive && 'before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-r before:bg-white')}>{inner}{toggle}</NavLink>
      : <button type="button" data-testid={`nav-${g.key}`} data-toggle-testid={`nav-${g.key}-toggle`} aria-expanded={open} onClick={() => setOpen(!open)} className={clsx(rowCls(active && !open), 'w-full')}>{inner}<span className="grid h-6 w-6 place-items-center">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span></button>}
    {open && <ul data-testid={`nav-${g.key}-items`} className="ml-3 border-l border-white/10 pl-1">{children.map((r) => { const RIcon = r.icon; return <li key={r.key}><NavLink to={r.path} end={r.path === '/jobs'} data-testid={`nav-${r.key}`} className={childCls}><RIcon size={13} className="shrink-0 text-[#93a1b4]" />{r.label}</NavLink></li>; })}</ul>}
  </li>;
};

export const Sidebar = () => {
  const { user } = useAuth(); const { pathname } = useLocation();
  const all = navForTier(user!.accessTier);
  // A group renders where its first member sits; everything else stays a flat item
  const rows: (NavItem | NavGroup)[] = []; all.forEach((i) => { if (i.group) { const g = NAV_GROUPS.find((x) => x.key === i.group)!; if (!rows.includes(g)) rows.push(g); } else rows.push(i); });
  return (
    <aside data-testid="sidebar" className="flex w-[216px] shrink-0 flex-col bg-ink text-[#c7d0dc]">
      <div className="flex h-12 items-center gap-2 px-4"><span className="grid h-6 w-6 place-items-center rounded-sm bg-white/10 font-mono text-[11px] font-semibold text-white">RS</span><span className="text-[14px] font-semibold tracking-tight text-white">RolliSuite</span></div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Primary">
        <ul className="space-y-px">
          {rows.map((row) => {
            if (!('path' in row) || !('tiers' in row)) { const g = row as NavGroup; return <Group key={g.key} g={g} items={all.filter((i) => i.group === g.key)} pathname={pathname} />; }
            const item = row; const Icon = item.icon;
            return <li key={item.key} className={clsx(item.pinned && 'mb-2')}>
              <NavLink to={item.path} end={item.path === '/'} data-testid={`nav-${item.key}`} className={({ isActive }) => clsx(rowCls(isActive && !item.pinned), item.pinned && 'bg-moss/20 text-white ring-1 ring-inset ring-moss/60 hover:bg-moss/30', isActive && !item.pinned && 'before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-r before:bg-white', isActive && item.pinned && 'bg-moss/40')}>
                <Icon size={15} strokeWidth={1.9} className={clsx('shrink-0', item.pinned ? 'text-moss-100' : 'text-[#93a1b4] group-hover:text-white')} /><span className="truncate">{item.label}</span>{item.pinned && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-moss-100" aria-hidden />}
              </NavLink>
            </li>;
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-[#8b98aa]"><div className="font-medium text-[#c7d0dc]">Access tier</div><div data-testid="sidebar-tier" className="capitalize">{user!.accessTier}</div></div>
    </aside>
  );
};
