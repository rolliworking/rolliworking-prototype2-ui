import { Check, Watch } from 'lucide-react';
import type { Division, KioskResult, KioskService } from '@/api/client';
import * as api from '@/api/client';

export interface KioskForm { firstName: string; lastName: string; email: string; phone: string; notes: string }

const Primary = ({ children, testId, onClick, disabled }: { children: React.ReactNode; testId: string; onClick?: () => void; disabled?: boolean }) => (
  <button type="submit" data-testid={testId} onClick={onClick} disabled={disabled} className="rounded-full bg-rc-ink px-10 py-4 text-lg font-semibold text-rc-paper shadow-pop transition-transform hover:-translate-y-px active:translate-y-px disabled:opacity-40">{children}</button>
);
const Back = ({ onClick }: { onClick: () => void }) => <button type="button" data-testid="kiosk-back" onClick={onClick} className="rounded-full border border-rc-line px-6 py-4 text-base text-rc-muted hover:bg-rc-paper">Back</button>;

export const IdleStep = ({ onStart }: { onStart: () => void }) => (
  <button data-testid="kiosk-idle" onClick={onStart} className="flex flex-col items-center gap-8 text-center">
    <Watch size={72} strokeWidth={1} className="text-rc-accent" />
    <div><h1 className="font-serif text-5xl font-light tracking-tight sm:text-6xl">Welcome</h1><p className="mt-3 text-lg text-rc-muted">Touch to check in for service</p></div>
    <span className="mt-6 rounded-full bg-rc-accentSoft px-6 py-2 text-sm font-medium uppercase tracking-[0.2em] text-rc-accent">Tap to begin</span>
  </button>
);

export const BrandStep = ({ onPick }: { onPick: (d: Division) => void }) => (
  <div data-testid="kiosk-brand" className="w-full max-w-3xl space-y-10 text-center">
    <h2 className="font-serif text-4xl font-light">Who are you visiting today?</h2>
    <div className="grid gap-6 sm:grid-cols-2">{api.KIOSK_BRANDS.map((b) => (
      <button key={b.division} data-testid={`kiosk-brand-${b.division}`} onClick={() => onPick(b.division)} className="group rounded-2xl border border-rc-line bg-rc-paper px-8 py-12 shadow-card transition-transform hover:-translate-y-0.5 hover:border-rc-accent">
        <div className={`font-serif text-4xl tracking-tight ${b.division === 'rolliworks' ? 'font-light text-rc-ink' : 'font-semibold text-rc-accent'}`}>{b.name}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.25em] text-rc-muted">{b.tagline}</div>
      </button>
    ))}</div>
  </div>
);

export const ServicesStep = ({ selected, onToggle, onBack, onContinue }: { selected: KioskService[]; onToggle: (k: KioskService) => void; onBack: () => void; onContinue: () => void }) => (
  <div data-testid="kiosk-services" className="w-full max-w-3xl space-y-8 text-center">
    <div><h2 className="font-serif text-4xl font-light">What can we help with?</h2><p className="mt-2 text-rc-muted">Choose any that apply — or skip if you’re not sure.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{api.KIOSK_SERVICES.map((s) => { const on = selected.includes(s.key); return (
      <button key={s.key} data-testid={`kiosk-service-${s.key}`} aria-pressed={on} onClick={() => onToggle(s.key)} className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-colors ${on ? 'border-rc-accent bg-rc-accentSoft' : 'border-rc-line bg-rc-paper hover:border-rc-accent/50'}`}>
        <span><span className="block text-lg font-medium">{s.label}</span><span className="text-xs text-rc-muted">{s.blurb}</span></span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${on ? 'border-rc-accent bg-rc-accent text-white' : 'border-rc-line'}`}>{on && <Check size={16} />}</span>
      </button>
    ); })}</div>
    <div className="flex items-center justify-center gap-4"><Back onClick={onBack} /><Primary testId="kiosk-services-continue" onClick={onContinue}>{selected.length ? `Continue (${selected.length})` : 'Skip — Continue'}</Primary></div>
  </div>
);

const Field = ({ label, testId, value, onChange, type = 'text', required, autoFocus }: { label: string; testId: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; autoFocus?: boolean }) => (
  <label className="block text-left"><span className="text-xs uppercase tracking-wide text-rc-muted">{label}{required && ' *'}</span><input data-testid={testId} type={type} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-rc-line bg-rc-paper px-4 py-3 text-lg outline-none focus:border-rc-accent" /></label>
);

export const FormStep = ({ form, onChange, error, onBack, onSubmit }: { form: KioskForm; onChange: (f: KioskForm) => void; error: string | null; onBack: () => void; onSubmit: () => void }) => {
  const set = (k: keyof KioskForm) => (v: string) => onChange({ ...form, [k]: v });
  return <form data-testid="kiosk-form" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="w-full max-w-2xl space-y-6 text-center">
    <div><h2 className="font-serif text-4xl font-light">How can we reach you?</h2><p className="mt-2 text-rc-muted">A concierge will be with you shortly.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" testId="kiosk-first" value={form.firstName} onChange={set('firstName')} required autoFocus /><Field label="Last name" testId="kiosk-last" value={form.lastName} onChange={set('lastName')} required /><Field label="Email" testId="kiosk-email" type="email" value={form.email} onChange={set('email')} required /><Field label="Phone" testId="kiosk-phone" type="tel" value={form.phone} onChange={set('phone')} required /></div>
    <label className="block text-left"><span className="text-xs uppercase tracking-wide text-rc-muted">Anything we should know? (optional)</span><textarea data-testid="kiosk-notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-rc-line bg-rc-paper px-4 py-3 text-base outline-none focus:border-rc-accent" /></label>
    {error && <p data-testid="kiosk-error" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
    <div className="flex items-center justify-center gap-4"><Back onClick={onBack} /><Primary testId="kiosk-submit">Check in</Primary></div>
  </form>;
};

export const ThanksStep = ({ result, brand }: { result: KioskResult; brand: Division }) => (
  <div data-testid="kiosk-thanks" className="max-w-xl space-y-6 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rc-accentSoft text-rc-accent"><Check size={40} /></div>
    <h2 className="font-serif text-5xl font-light">Thank you, {result.request.kiosk!.firstName}.</h2>
    <p className="text-lg text-rc-muted">You’re checked in with {api.KIOSK_BRANDS.find((b) => b.division === brand)!.name}. Please have a seat — a concierge will be with you shortly.</p>
    <p data-testid="kiosk-thanks-ref" className="font-mono text-xs text-rc-muted/70">Reference {result.request.number}</p>
  </div>
);
