import { Eye, LogOut, MessageCircle } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { RcSessionProvider, useRcSession } from './RcSession';

const PUBLIC = ['/rc', '/rc/'];

function Frame() {
  const { client, viewAs, loading, signOut } = useRcSession();
  const { pathname } = useLocation(); const nav = useNavigate();
  const isPublic = PUBLIC.includes(pathname) || pathname.startsWith('/rc/auth/') || pathname.startsWith('/rc/report/') || pathname.startsWith('/rc/inspection/');
  if (loading) return null;
  if (!client && !isPublic) return <Navigate to="/rc" replace />;
  return (
    <div data-testid="rc-shell" className="min-h-screen bg-rc-cream font-sans text-rc-ink antialiased">
      <div data-testid="rc-draft-banner" className="bg-rc-ink px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-rc-cream">
        Draft — RolliConnect preview · fake data · nothing here is sent or charged
      </div>
      {viewAs && client && <div data-testid="rc-view-as-banner" className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.18em] text-amber-950"><Eye size={14} /> Viewing as client — {client.firstName} {client.lastName} <span className="font-normal normal-case tracking-normal text-amber-900/80">· exactly what they see · staff-only data excluded · {viewAs.by}</span><button type="button" data-testid="rc-view-as-exit" onClick={() => void api.exitViewAsClient().then((to) => nav(to))} className="ml-2 rounded-full bg-amber-950 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-100 hover:bg-black">Exit to staff view</button></div>}
      <header className="mx-auto flex w-full max-w-[880px] items-center justify-between px-6 py-6">
        <Link to={client ? '/rc/home' : '/rc'} className="font-serif text-2xl font-medium tracking-tight" data-testid="rc-wordmark">
          Rolli<span className="text-rc-accent">Connect</span>
        </Link>
        {client && (
          <nav className="flex items-center gap-5 text-sm">
            <NavLink to="/rc/home" data-testid="rc-nav-home" className={({ isActive }) => (isActive ? 'text-rc-ink underline decoration-rc-accent underline-offset-4' : 'text-rc-muted hover:text-rc-ink')}>My watches</NavLink>
            <NavLink to="/rc/messages" data-testid="rc-nav-messages" className={({ isActive }) => `inline-flex items-center gap-1 ${isActive ? 'text-rc-ink underline decoration-rc-accent underline-offset-4' : 'text-rc-muted hover:text-rc-ink'}`}><MessageCircle size={14} /> Messages</NavLink>
            <span className="text-rc-muted">·</span>
            <span className="text-rc-muted" data-testid="rc-session-name">{client.firstName}</span>
            <button type="button" data-testid="rc-sign-out" onClick={() => void signOut()} className="inline-flex items-center gap-1 text-rc-muted hover:text-rc-ink"><LogOut size={14} /> Sign out</button>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-[880px] px-6 pb-24">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-[880px] px-6 pb-10 text-xs text-rc-muted">RolliConnect is a preview. Questions? Use Messages — a person replies.</footer>
    </div>
  );
}

export default function RcShell() {
  return (
    <RcSessionProvider>
      <Frame />
    </RcSessionProvider>
  );
}
