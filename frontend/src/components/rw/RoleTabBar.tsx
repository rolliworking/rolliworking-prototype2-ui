import { ClipboardCheck, Clock3, Hammer, ListChecks, Camera, MessageSquare, Users, ListOrdered, MousePointerClick, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import { slugOf } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { roleKind, type RoleKind } from '@/config/roles';
import type { User } from '@/api/client';

// iPad shell: persistent, thumb-height bottom tab bar scoped to the ROLE (viewed role under View-as). Kiosk routes and /choose-view never mount this (they live outside RwShell).
interface Tab { key: string; label: string; to: string; icon: LucideIcon; match?: (p: string) => boolean }
export const roleTabs = (u: User): Tab[] => {
  const k: RoleKind = roleKind(u); const slug = slugOf(u);
  const hit: Tab = { key: 'hitlist', label: 'Hitlist', to: `/rw/hitlist/${slug}`, icon: ListChecks, match: (p) => p.startsWith('/rw/hitlist/') && !p.endsWith('/team') };
  const photos: Tab = { key: 'photos', label: 'Photos', to: '/rw/evidence', icon: Camera };
  const msgs: Tab = { key: 'messages', label: 'Messages', to: '/rw/messages', icon: MessageSquare };
  const clock: Tab = { key: 'clock', label: 'Clock', to: '/time/pad', icon: Clock3 };
  if (k === 'watchmaker') return [{ key: 'bench', label: 'Bench', to: '/rw/bench', icon: Hammer }, hit, photos, msgs, clock];
  if (k === 'band_tech') return [{ key: 'band', label: 'Band pad', to: '/rw/band', icon: Hammer }, hit, photos, msgs, clock];
  const pad = u.roles.some((r) => r === 'band_tech' || r === 'polisher') && !u.roles.includes('watchmaker') && !u.roles.includes('supervisor') ? '/rw/band' : '/rw/pad';
  return [{ key: 'pad', label: 'Pad', to: pad, icon: ClipboardCheck, match: (p) => p === '/rw/pad' || p === '/rw/band' }, { key: 'team', label: 'Team hitlist', to: `/rw/hitlist/${slug}/team`, icon: Users }, { key: 'queue', label: 'Queue', to: '/rw/queue', icon: ListOrdered }, { key: 'assign', label: 'Assign', to: '/rw/assign', icon: MousePointerClick }, { key: 'vendors', label: 'Vendors', to: '/rw/concierge', icon: Truck }, msgs, clock];
};
export const ROLE_TABBAR_H = 64;
export const RoleTabBar = () => {
  const { user } = useAuth(); const { pathname } = useLocation();
  if (!user) return null;
  const tabs = roleTabs(user); const unread = hl.unreadCount(user.id);
  return <nav data-testid="role-tabbar" data-role={roleKind(user)} style={{ height: ROLE_TABBAR_H, paddingBottom: 'env(safe-area-inset-bottom)' }} className="fixed inset-x-0 bottom-0 z-[60] grid border-t border-white/10 bg-[#0b0f14] text-slate-400" >
    <div className="mx-auto grid w-full max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => { const active = t.match ? t.match(pathname) : pathname === t.to || pathname.startsWith(t.to + '/'); const Icon = t.icon; return <NavLink key={t.key} to={t.to} data-testid={`role-tab-${t.key}`} data-active={active} className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-accent' : 'text-slate-400 active:text-slate-200'}`}><span className="relative"><Icon size={24} />{t.key === 'messages' && unread > 0 && <span data-testid="role-tab-messages-unread" className="absolute -right-3 -top-1.5 rounded-full bg-rose-600 px-1.5 font-mono text-[10px] text-white">{unread}</span>}</span>{t.label}</NavLink>; })}
    </div>
  </nav>;
};
