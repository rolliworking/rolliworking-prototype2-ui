import { Eye, Lock, LogOut, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard } from './RcBits';
import { RcSessionProvider, useRcSession } from './RcSession';

const AUTH_ROUTES = ['/rc', '/rc/', '/rc/signup'];

// The login wall — a branded stop, never a dead page: sign in or create an account, then continue to the same document
const LockWall = ({ next, docType }: { next: string; docType: api.RcDocType | null }) => (
  <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-lock-wall" data-doc={docType ?? ''}>
    <RcCard eyebrow="Private" title={<span className="inline-flex items-center gap-2"><Lock size={20} className="text-rc-accent" /> Sign in to view this</span>}>
      <p className="text-[15px] leading-relaxed text-rc-muted">{docType ? `${api.RC_DOC_META[docType].label.split(' ·')[0]} are` : 'This page is'} only visible to the account holder. Sign in with a one-time code we email you — no password — or create your account the same way. You’ll land right back here.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Link to={`/rc?next=${encodeURIComponent(next)}`} data-testid="rc-lock-signin"><RcButton type="button"><ShieldCheck size={15} className="mr-1 inline" /> Sign in</RcButton></Link><Link to={`/rc/signup?next=${encodeURIComponent(next)}`} data-testid="rc-lock-signup"><RcButton type="button" tone="quiet">Create account</RcButton></Link></div>
    </RcCard>
  </div>
);

function Frame() {
  const { client, viewAs, loading, signOut } = useRcSession();
  const { pathname, search } = useLocation(); const nav = useNavigate();
  const docType = api.rcDocTypeForPath(pathname);
  const linkToken = new URLSearchParams(search).get('t'); // LINK tier: the page validates the token itself and shows the expired copy
  const isPublic = AUTH_ROUTES.includes(pathname) || pathname.startsWith('/rc/auth/') || pathname.startsWith('/rc/pickup/') || (!!linkToken && (docType === 'estimate' || docType === 'invoice' || pathname.startsWith('/rc/parts/'))) || (docType !== null && api.rcDocAccess()[docType] === 'public');
  if (loading) return null;
  const wall = !client && !isPublic;
  return (
    <div data-testid="rc-shell" className="min-h-screen bg-rc-cream font-sans text-rc-ink antialiased">
      <div data-testid="rc-draft-banner" className="bg-rc-ink px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-rc-cream">
        Draft — RolliConnect preview · fake data · nothing here is sent or charged
      </div>
      {viewAs && client && <div data-testid="rc-view-as-banner" className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.18em] text-amber-950"><Eye size={14} /> Viewing as client — {client.firstName} {client.lastName} <span className="font-normal normal-case tracking-normal text-amber-900/80">· exactly what they see · staff-only data excluded · {viewAs.by}</span><button type="button" data-testid="rc-view-as-exit" onClick={() => void api.exitViewAsClient().then((to) => nav(to))} className="ml-2 rounded-full bg-amber-950 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-100 hover:bg-black">Exit to staff view</button></div>}
      <header className="mx-auto flex w-full max-w-[880px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <Link to={client ? '/rc/home' : '/rc'} className="font-serif text-2xl font-medium tracking-tight" data-testid="rc-wordmark">
          Rolli<span className="text-rc-accent">Connect</span>
        </Link>
        {client ? (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <NavLink to="/rc/home" data-testid="rc-nav-home" className={({ isActive }) => (isActive ? 'text-rc-ink underline decoration-rc-accent underline-offset-4' : 'text-rc-muted hover:text-rc-ink')}>My watches</NavLink>
            <NavLink to="/rc/messages" data-testid="rc-nav-messages" className={({ isActive }) => `inline-flex items-center gap-1 ${isActive ? 'text-rc-ink underline decoration-rc-accent underline-offset-4' : 'text-rc-muted hover:text-rc-ink'}`}><MessageCircle size={14} /> Messages</NavLink>
            <NavLink to="/rc/account" data-testid="rc-nav-account" className={({ isActive }) => `inline-flex items-center gap-1 ${isActive ? 'text-rc-ink underline decoration-rc-accent underline-offset-4' : 'text-rc-muted hover:text-rc-ink'}`}><ShieldCheck size={14} /> Account</NavLink>
            <span className="text-rc-muted">·</span>
            <span className="text-rc-muted" data-testid="rc-session-name">{client.firstName}</span>
            <button type="button" data-testid="rc-sign-out" onClick={() => void signOut().then(() => nav('/rc'))} className="inline-flex items-center gap-1 text-rc-muted hover:text-rc-ink"><LogOut size={14} /> Sign out</button>
          </nav>
        ) : !AUTH_ROUTES.includes(pathname) && <Link to={`/rc?next=${encodeURIComponent(pathname + search)}`} data-testid="rc-nav-signin" className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink"><Lock size={14} /> Sign in</Link>}
      </header>
      <main className="mx-auto w-full max-w-[880px] px-4 pb-24 sm:px-6">
        {wall ? <LockWall next={pathname + search} docType={docType} /> : <Outlet />}
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
