import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClockState, Punch } from '@/api/client';
import { fmtTime } from '@/lib/format';
import { useRg } from './RgShell';

export default function RgClockPage() {
  const { user } = useRg(); const nav = useNavigate(); const [params] = useSearchParams();
  const tagId = params.get('tag') ?? ''; const simulated = params.get('sim') === '1'; const tag = api.getNfcTag(tagId);
  const [state, setState] = useState<ClockState | null>(null); const [done, setDone] = useState<Punch | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api.getClockState(user.id).then(setState); }, [user.id]);
  useEffect(() => { if (!done) return; const t = setTimeout(() => nav('/rg'), 4000); return () => clearTimeout(t); }, [done, nav]);
  const confirm = () => { setBusy(true); setErr(null); api.punchClock(tagId, simulated).then(setDone).catch((e) => setErr(e.message)).finally(() => setBusy(false)); };

  if (!tag) return <div data-testid="rg-clock-unknown" className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Unknown tag</p><p className="text-xs">“{tagId || '—'}” is not a registered NFC tag. Ask a manager to register it in Setup.</p><Link to="/rg" className="text-xs underline">← Back</Link></div>;
  if (done) return <div data-testid="rg-clock-done" className={`space-y-2 rounded-lg p-5 text-center text-white ${done.kind === 'in' ? 'bg-moss' : 'bg-ink-700'}`}>
    <div className="text-[11px] uppercase tracking-wide text-white/70">{user.shortName}</div>
    <div data-testid="rg-clock-done-label" className="text-3xl font-semibold">Clocked {done.kind}</div>
    <div className="text-sm text-white/85">{fmtTime(done.at)} · {done.location} · {api.RG_DIVISION_LABEL[done.division]}</div>
    <Link to="/rg" data-testid="rg-clock-back" className="inline-block pt-2 text-xs text-white/80 underline">Back to RGTime</Link>
  </div>;
  const nextKind = state?.onClock ? 'out' : 'in';
  return <div data-testid="rg-clock-page" className="space-y-4">
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500"><MapPin size={12} /> Tag location</div>
      <div data-testid="rg-clock-location" className="mt-1 text-lg font-semibold text-ink">{tag.label}</div>
      <div className="text-xs text-ink-500">{api.RG_DIVISION_LABEL[tag.division]} · tag <span className="font-mono">{tag.id}</span>{simulated && <span className="ml-1 text-amber-700">· simulated tap</span>}</div>
      {state && <div data-testid="rg-clock-current" className="mt-3 text-xs text-ink-500">{state.onClock ? `On the clock since ${fmtTime(state.since!)} (${state.sinceLocation})` : 'Currently off the clock'}</div>}
    </div>
    <button data-testid="rg-clock-confirm" disabled={!state || busy} onClick={confirm} className={`w-full rounded-xl py-5 text-xl font-semibold text-white shadow-pop active:translate-y-px disabled:opacity-50 ${nextKind === 'in' ? 'bg-moss hover:bg-moss-700' : 'bg-ink hover:bg-ink-700'}`}>{state ? `Clock ${nextKind} — ${user.shortName}` : '…'}</button>
    {err && <p data-testid="rg-clock-error" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
    <Link to="/rg" data-testid="rg-clock-cancel" className="block text-center text-xs text-ink-500 underline">Not now</Link>
  </div>;
}
