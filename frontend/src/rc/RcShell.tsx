import { LogOut, MessageCircle } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { RcSessionProvider, useRcSession } from './RcSession';

const PUBLIC = ['/rc', '/rc/'];

function Frame() {
  const { client, loading, signOut } = useRcSession();
  const { pathname } = useLocation();
  const isPublic = PUBLIC.includes(pathname) || pathname.startsWith('/rc/auth/') || pathname.startsWith('/rc/report/');
  if (loading) return null;
  if (!client && !isPublic) return <Navigate to="/rc" replace />;
  return (
    <div data-testid="rc-shell" className="min-h-screen bg-rc-cream font-sans text-rc-ink antialiased">
      <div data-testid="rc-draft-banner" className="bg-rc-ink px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-rc-cream">
        Draft — RolliConnect preview · fake data · nothing here is sent or charged
      </div>
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
