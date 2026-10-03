import clsx from 'clsx';
import { Activity, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Division } from '@/api/client';
import * as wm8 from '@/api/watchm8';
import { CheckTab } from '@/components/rwcom/CheckTab';
import { IdentifyTab } from '@/components/rwcom/IdentifyTab';
import { RequestTab } from '@/components/rwcom/RequestTab';
import { DEV, DeviceCtx, type Device } from '@/components/rwcom/RwcomBits';
import { InstrumentPanel } from '@/components/rwcom/RwcomDev';
import { EMPTY_STATE, type RwState } from '@/components/rwcom/rwState';
import { PageHeader } from '@/components/ui/Button';

type Tab = 'identify' | 'check' | 'request';
const TABS: { key: Tab; label: string }[] = [{ key: 'identify', label: 'Identify' }, { key: 'check', label: 'Check' }, { key: 'request', label: 'Request' }];
const asTab = (v: string | null): Tab => (v === 'check' || v === 'request' ? v : 'identify');

const Seg = ({ on, onClick, testId, children }: { on: boolean; onClick: () => void; testId: string; children: ReactNode }) => <button type="button" data-testid={testId} data-active={on} aria-pressed={on} onClick={onClick} className={clsx('inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs transition-colors', on ? 'bg-ink text-white' : 'text-ink-700 hover:bg-canvas')}>{children}</button>;

// Phone 390×844 (default) · Desktop. The site inside is phone-first; `DeviceCtx` is what the tabs read for two-column layouts.
const PhoneFrame = ({ children }: { children: ReactNode }) => (
  <div data-testid="device-frame" data-device="phone" className="rounded-[40px] border-[8px] border-ink bg-ink shadow-pop"><div className="flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[32px] bg-rc-cream">
    <div className="relative flex h-7 shrink-0 items-center justify-between px-6 text-[11px] font-medium text-rc-ink"><span>9:41</span><span className="absolute left-1/2 top-1 h-4 w-24 -translate-x-1/2 rounded-full bg-black" /><span>●●●</span></div>
    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
  </div></div>
);
const DesktopFrame = ({ url, children }: { url: string; children: ReactNode }) => (
  <div data-testid="device-frame" data-device="desktop" className="w-full overflow-hidden rounded-xl border border-line bg-surface shadow-card">
    <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-3 py-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-moss" /><span data-testid="desktop-url" className="ml-3 flex-1 truncate rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-ink-500 ring-1 ring-line">{url}</span></div>
    <div className="max-h-[820px] overflow-y-auto">{children}</div>
  </div>
);

export default function RwcomPage() {
  const [sp, setSp] = useSearchParams();
  const tab = asTab(sp.get('tab')); const device: Device = sp.get('frame') === 'desktop' ? 'desktop' : 'phone'; const entity: Division = sp.get('entity') === 'rollishop' ? 'rollishop' : 'rolliworks';
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v))); setSp(n, { replace: true }); };
  const [state, setState] = useState<RwState>(() => { const ref = sp.get('ref'); const row = ref ? wm8.refByCode(ref) : undefined; return { ...EMPTY_STATE, ref: row?.ref ?? (ref?.trim() || undefined), brand: row?.brand, model: row?.model }; });
  const [claimNote, setClaimNote] = useState<string | null>(null); const [devOpen, setDevOpen] = useState(false);
  const update = (p: Partial<RwState>) => setState((s) => ({ ...s, ...p }));
  // &claim= pre-attaches a saved phone session (D-417); an unknown code is a dismissible line, never a blocked page
  useEffect(() => {
    const code = sp.get('claim'); if (!code) return; const c = wm8.findClaim(code);
    if (!c) { setClaimNote(`Claim code ${code.toUpperCase()} not found — start fresh, or check the code from your text.`); return; }
    const r = c.results as Partial<RwState>; const row = r.ref ? wm8.refByCode(r.ref) : undefined;
    setState((s) => ({ ...s, ref: s.ref ?? row?.ref ?? r.ref, brand: s.brand ?? row?.brand, model: s.model ?? row?.model, bracelet: s.bracelet ?? r.bracelet, serialPrefix: s.serialPrefix ?? r.serialPrefix, claim: c.code, shots: { ...Object.fromEntries(c.photos.map((p) => [p.key, p.dataUrl])), ...s.shots } }));
    setClaimNote(`Picked up ${c.photos.length} photo${c.photos.length === 1 ? '' : 's'} and your results from claim ${c.code}.`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if ((state.ref ?? null) !== sp.get('ref')) set({ ref: state.ref ?? null }); }, [state.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTab = (t: Tab) => set({ tab: t });
  const host = entity === 'rolliworks' ? 'rolliworks.com' : 'rollishop.com';

  const site = (
    <div data-testid="rwcom-site" data-entity={entity} data-tab={tab} className="min-h-full bg-rc-cream font-sans text-rc-ink">
      <header className="sticky top-0 z-10 border-b border-rc-line bg-rc-cream/95 px-4 py-3 backdrop-blur">
        <div className={clsx('flex items-center justify-between', device === 'desktop' && 'mx-auto max-w-5xl')}><span data-testid="rwcom-wordmark" className="font-serif text-lg tracking-tight">{host.replace('.com', '')}<span className="text-rc-accent">.com</span></span><span className="text-[10px] uppercase tracking-[0.18em] text-rc-muted">{api.entityName(entity)} · service</span></div>
        <nav className={clsx('mt-2 flex gap-1', device === 'desktop' && 'mx-auto max-w-5xl')} data-testid="rwcom-tabs">{TABS.map((t) => <button key={t.key} type="button" data-testid={`rwcom-tab-${t.key}`} aria-selected={tab === t.key} onClick={() => goTab(t.key)} className={clsx('flex-1 rounded-full px-3 py-1.5 text-sm transition-colors', tab === t.key ? 'bg-rc-ink text-rc-cream' : 'text-rc-muted hover:bg-rc-accentSoft')}>{t.label}</button>)}</nav>
      </header>
      {claimNote && <div data-testid="claim-note" className={clsx('mx-4 mt-3 flex items-start justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200', device === 'desktop' && 'lg:mx-auto lg:max-w-5xl')}><span>{claimNote}</span><button type="button" data-testid="claim-note-dismiss" aria-label="Dismiss" onClick={() => setClaimNote(null)} className="shrink-0 px-1 text-amber-900/70 hover:text-amber-900">×</button></div>}
      <main key={tab} className={clsx('px-4 py-5', device === 'desktop' && 'mx-auto max-w-5xl px-8 py-8')}>
        {tab === 'identify' && <IdentifyTab state={state} update={update} goTab={goTab} />}
        {tab === 'check' && <CheckTab state={state} update={update} goTab={goTab} />}
        {tab === 'request' && <RequestTab state={state} update={update} entity={entity} goTab={goTab} />}
      </main>
      <footer className={clsx('px-4 pb-6 pt-2 text-[11px] text-rc-muted', device === 'desktop' && 'mx-auto max-w-5xl px-8')}>© Rolli Group · {host} · Photos stay on your device until you send a request.</footer>
    </div>
  );

  return (
    <div data-testid="rwcom-page" data-frame={device}>
      <PageHeader title="rw.com" subtitle="Emulator of the public site flows — Identify · Check · Request. NOT-KEEPER: in KEEPER this is the public website; the only shared seam is watchm8.ts." action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5" data-testid="frame-toggle"><Seg testId="frame-phone" on={device === 'phone'} onClick={() => set({ frame: null })}><Smartphone size={12} /> Phone 390×844</Seg><Seg testId="frame-desktop" on={device === 'desktop'} onClick={() => set({ frame: 'desktop' })}><Monitor size={12} /> Desktop</Seg></div>
          <div className="flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5" data-testid="entity-toggle" title="Decided by which site the widget is embedded on — never a client choice"><Seg testId="entity-rolliworks" on={entity === 'rolliworks'} onClick={() => set({ entity: null })}>Rolliworks</Seg><Seg testId="entity-rollishop" on={entity === 'rollishop'} onClick={() => set({ entity: 'rollishop' })}>RolliShop</Seg></div>
          {DEV && <Seg testId="dev-panel-toggle" on={devOpen} onClick={() => setDevOpen(!devOpen)}><Activity size={12} /> Instrumentation</Seg>}
        </div>} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className={clsx('flex min-w-0 flex-1', device === 'phone' && 'justify-center')}><DeviceCtx.Provider value={device}>{device === 'phone' ? <PhoneFrame>{site}</PhoneFrame> : <DesktopFrame url={`https://${host}/service?tab=${tab}${state.ref ? `&ref=${state.ref}` : ''}`}>{site}</DesktopFrame>}</DeviceCtx.Provider></div>
        {DEV && devOpen && <InstrumentPanel onClose={() => setDevOpen(false)} />}
      </div>
    </div>
  );
}
