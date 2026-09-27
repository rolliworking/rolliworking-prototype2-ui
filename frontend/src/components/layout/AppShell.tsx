import { CornerLookup } from '@/components/layout/CornerLookup';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import * as api from '@/api/client';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { QuickAddProvider } from '@/components/today/QuickAddOverlay';
import { CompanionDock, CompanionProvider } from '@/components/companion/CompanionPanel';
import { CallPopToast } from '@/components/layout/CallPop';

// E17: banner reads config + last-call health. Click the chip to flip hybrid ↔ mock (safety line).
export const PrototypeBanner = () => {
  const [h, setH] = useState(api.getApiHealth());
  useEffect(() => api.subscribeApiHealth(() => setH(api.getApiHealth())), []);
  const live = api.API_MODE === 'hybrid'; const down = live && h.lastOk === false;
  return (
    <div data-testid="prototype-banner" className={`flex h-6 shrink-0 items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${down ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
      Prototype — fake data
      <button data-testid="prototype-banner-source" data-source={live ? (down ? 'live-degraded' : 'live') : 'mock'} onClick={() => api.setApiMode(live ? 'mock' : 'hybrid')} title={live ? `${api.API_BASE_URL}${h.lastAt ? ` · last call ${h.lastOk ? 'ok' : 'failed'}` : ''} — click to switch to MOCK` : 'Click to switch to LIVE API (hybrid)'} className="rounded-sm border border-current/30 px-1.5 py-px normal-case tracking-normal hover:bg-white/40">
        · {live ? (down ? 'LIVE API — unreachable, showing mock' : 'LIVE API') : 'MOCK'}
      </button>
    </div>
  );
};

// Non-blocking toast for real-call failures (routing.ts dispatches the event)
export const ApiToast = () => {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); setTimeout(() => setMsg(null), 4000); }; window.addEventListener(api.API_TOAST_EVENT, on); return () => window.removeEventListener(api.API_TOAST_EVENT, on); }, []);
  if (!msg) return null;
  return <div data-testid="api-toast" className="pointer-events-none fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs font-medium text-white shadow-pop animate-rise">{msg}</div>;
};

// Never white-screen: a render crash (e.g. a live-API shape mismatch) shows this panel instead of a blank page
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; path: string }> {
  state = { error: null as Error | null, path: window.location.pathname };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate() { if (this.state.error && window.location.pathname !== this.state.path) this.setState({ error: null, path: window.location.pathname }); }
  render() {
    if (!this.state.error) return this.props.children;
    console.error('[ui] render crash', this.state.error);
    return <div data-testid="route-error" className="m-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><div className="font-semibold">This screen hit an error and was contained.</div><div className="mt-1 font-mono text-xs">{this.state.error.message}</div>{api.API_MODE === 'hybrid' && <div className="mt-2 text-xs">Live-API data shape may not match what this screen expects (logged for the E17 report). <button data-testid="route-error-mock" onClick={() => api.setApiMode('mock')} className="underline">Switch to MOCK data</button> · <button onClick={() => this.setState({ error: null })} className="underline">Retry</button></div>}</div>;
  }
}

export default function AppShell() {
  return (
    <QuickAddProvider>
    <CompanionProvider>
      <div className="flex h-full flex-col">
        <PrototypeBanner />
        <ApiToast />
        <CornerLookup variant="rs" />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main data-testid="main-content" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <RouteErrorBoundary><Outlet /></RouteErrorBoundary>
            </main>
          </div>
          <CompanionDock />
          <CallPopToast />
        </div>
      </div>
    </CompanionProvider>
    </QuickAddProvider>
  );
}
