import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { Division, KioskResult, KioskService } from '@/api/client';
import { BrandStep, FormStep, IdleStep, ServicesStep, ThanksStep, type KioskForm } from './KioskSteps';

type Step = 'idle' | 'brand' | 'services' | 'form' | 'thanks';
const DIM_AFTER_MS = 30_000;
const ABANDON_AFTER_MS = 120_000;
const THANKS_RESET_MS = 5_000;
const EMPTY_FORM: KioskForm = { firstName: '', lastName: '', email: '', phone: '', notes: '' };

export default function KioskPage() {
  const [step, setStep] = useState<Step>('idle');
  const [brand, setBrand] = useState<Division | null>(null);
  const [services, setServices] = useState<KioskService[]>([]);
  const [form, setForm] = useState<KioskForm>(EMPTY_FORM);
  const [result, setResult] = useState<KioskResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dimmed, setDimmed] = useState(false);
  const lastActivity = useRef(Date.now());

  useEffect(() => { document.title = 'Welcome — check in'; return () => { document.title = 'RolliSuite — Prototype'; }; }, []);

  const reset = useCallback(() => { setStep('idle'); setBrand(null); setServices([]); setForm(EMPTY_FORM); setResult(null); setErr(null); }, []);
  const touch = useCallback(() => { lastActivity.current = Date.now(); setDimmed(false); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= DIM_AFTER_MS) setDimmed(true);
      if (idle >= ABANDON_AFTER_MS && step !== 'idle' && step !== 'thanks') reset();
    }, 1000);
    return () => clearInterval(id);
  }, [step, reset]);

  useEffect(() => { if (step !== 'thanks') return; const t = setTimeout(reset, THANKS_RESET_MS); return () => clearTimeout(t); }, [step, reset]);

  const submit = () => {
    setErr(null);
    api.submitKioskCheckIn({ brand: brand!, services, ...form, notes: form.notes || undefined }).then((r) => { setResult(r); setStep('thanks'); }).catch((e) => setErr(e.message));
  };

  return (
    <div data-testid="kiosk-page" data-step={step} onPointerDown={touch} onKeyDown={touch} className="relative flex h-full flex-col bg-rc-cream font-sans text-rc-ink">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-10">
        {step === 'idle' && <IdleStep onStart={() => setStep('brand')} />}
        {step === 'brand' && <BrandStep onPick={(d) => { setBrand(d); setStep('services'); }} />}
        {step === 'services' && <ServicesStep selected={services} onToggle={(k) => setServices((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} onBack={() => setStep('brand')} onContinue={() => setStep('form')} />}
        {step === 'form' && <FormStep form={form} onChange={setForm} error={err} onBack={() => setStep('services')} onSubmit={submit} />}
        {step === 'thanks' && result && <ThanksStep result={result} brand={brand!} />}
      </div>
      {step !== 'idle' && <footer className="flex items-center justify-between px-8 pb-4 text-[11px] text-rc-muted"><span>{brand ? api.KIOSK_BRANDS.find((b) => b.division === brand)!.name : ''}</span><button data-testid="kiosk-start-over" onClick={reset} className="underline">Start over</button></footer>}
      {dimmed && <button data-testid="kiosk-dim" onPointerDown={touch} className="absolute inset-0 z-10 flex items-end justify-center bg-black/70 pb-16 text-sm text-white/60 transition-opacity" aria-label="Wake screen">Touch anywhere</button>}
    </div>
  );
}
