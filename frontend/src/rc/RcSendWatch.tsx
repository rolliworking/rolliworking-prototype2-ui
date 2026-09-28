import { Check, MapPin, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CreateLabelSheet } from '@/components/shipping/ShippingBits';
import * as api from '@/api/client';
import type { Address, EstimateWithRefs, ShipServiceLevel } from '@/api/client';
import { RcButton, RcCard, RcError, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const Field = ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) => <div><RcLabel htmlFor={id}>{label}</RcLabel><input id={id} data-testid={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-rc-line bg-rc-paper px-3 py-2 text-[15px] outline-none focus:border-rc-ink" /></div>;

// "Send us your watch" — front and center on the estimate page. The client's own tap creates the Label Requests row (stage 1 of the inbound board).
export const RcSendWatch = ({ estimate: e, onChange }: { estimate: EstimateWithRefs; onChange: () => void }) => {
  const { client } = useRcSession(); const c = client!;
  const [addr, setAddr] = useState<Address>({ name: `${c.firstName} ${c.lastName}`, street: c.street, city: c.city, state: c.state }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [insured, setInsured] = useState<string>(''); const [level, setLevel] = useState<ShipServiceLevel>('1_day');
  const [selfServe, setSelfServe] = useState(false); const [sheet, setSheet] = useState<string | null>(null); const [refHint, setRefHint] = useState<api.RefValueSuggestion | null>(null);
  useEffect(() => { void api.getFeatureFlags().then((f) => setSelfServe(f.clientCreateLabel)); setRefHint(api.suggestInsuredByRef(e.watchId)); if (!insured) { const r = api.suggestInsuredByRef(e.watchId); if (r) setInsured(String(r.value)); } }, [e.watchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn: () => Promise<unknown>) => { setErr(null); setBusy(true); try { await fn(); onChange(); } catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong'); } finally { setBusy(false); } };
  if (sheet) return <CreateLabelSheet id={sheet} mode="client" clientId={c.id} onClose={() => { void api.portalCancelLabel(c.id, sheet).then(() => { setSheet(null); onChange(); }); }} onDone={() => { setSheet(null); onChange(); }} />;
  if (e.sendIntent) return <RcCard eyebrow="Sending your watch" testId="rc-send-confirmed">
    <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check size={16} /></span>
      <div className="text-[15px] leading-relaxed">{e.sendIntent.kind === 'label_created' ? <><span className="font-medium">Your prepaid label is on its way.</span> You created it yourself — check your email for the label PDF. The tracking number is already tied to this estimate.</> : e.sendIntent.kind === 'label' ? <><span className="font-medium">Label requested.</span> Our team will review your request and email a prepaid, fully insured shipping label — usually within one business day. Pack the watch in its box or a padded pouch; the label covers the value you declared.</> : <><span className="font-medium">See you soon.</span> Bring the watch to {api.SHOP_ADDRESS.line1}, {api.SHOP_ADDRESS.city}. {api.SHOP_ADDRESS.hours}. No appointment needed; ask for the service desk.</>}</div></div>
  </RcCard>;
  return <RcCard eyebrow="Send us your watch" title="Ready when you are" testId="rc-send-watch">
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <p className="text-[15px] text-rc-muted">Tell us where the label should ship from and how much to insure it for. We review each request, then email your prepaid label.</p>
        <Field id="rc-addr-name" label="Name" value={addr.name} onChange={(v) => setAddr({ ...addr, name: v })} />
        <Field id="rc-addr-street" label="Street" value={addr.street} onChange={(v) => setAddr({ ...addr, street: v })} />
        <div className="grid grid-cols-[1fr_90px] gap-3"><Field id="rc-addr-city" label="City" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} /><Field id="rc-addr-state" label="State" value={addr.state} onChange={(v) => setAddr({ ...addr, state: v.toUpperCase().slice(0, 2) })} /></div>
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div><RcLabel htmlFor="rc-insured-value">Insured value (USD)</RcLabel><div className="mt-1 flex items-center rounded-md border border-rc-line bg-rc-paper px-3 focus-within:border-rc-ink"><span className="text-rc-muted">$</span><input id="rc-insured-value" data-testid="rc-insured-value" type="number" min={1} step={100} placeholder="e.g. 12,000" value={insured} onChange={(ev) => setInsured(ev.target.value)} className="w-full bg-transparent py-2 pl-1 text-[15px] outline-none" /></div><p className="mt-1 text-xs text-rc-muted">Replacement value of the watch. Coverage is bound with the label.</p></div>
          <div><RcLabel htmlFor="rc-service-level">Shipping speed</RcLabel><div id="rc-service-level" data-testid="rc-service-level" role="radiogroup" className="mt-1 grid grid-cols-2 gap-2">{(['1_day', '2_day'] as ShipServiceLevel[]).map((l) => <button key={l} type="button" role="radio" aria-checked={level === l} data-testid={`rc-service-${l}`} onClick={() => setLevel(l)} className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${level === l ? 'border-rc-ink bg-rc-ink text-white' : 'border-rc-line bg-rc-paper text-rc-ink hover:border-rc-ink'}`}><div className="font-medium">{l === '1_day' ? '1-day' : '2-day'}</div><div className={`text-xs ${level === l ? 'text-white/70' : 'text-rc-muted'}`}>{l === '1_day' ? 'Overnight, signature' : 'Two business days'}</div></button>)}</div></div>
        </div>
        {refHint && <p data-testid="rc-ref-suggestion" className="text-sm text-rc-muted">Suggested: <b>${refHint.value.toLocaleString()}</b> (avg of {refHint.count} past shipment{refHint.count === 1 ? '' : 's'} of ref {refHint.reference}) — adjust up or down as you like.</p>}
        {selfServe ? <RcButton data-testid="rc-create-label" disabled={busy} onClick={async () => { setErr(null); setBusy(true); try { const p = await api.portalStartLabel(c.id, e.id, addr, level); setSheet(p.shipmentId); } catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong'); } finally { setBusy(false); } }}><Package size={16} /> Create shipping label</RcButton>
          : <RcButton data-testid="rc-request-label" disabled={busy} onClick={() => run(() => api.portalRequestLabel(c.id, e.id, { address: addr, insuredValue: Number(insured), serviceLevel: level }))}><Package size={16} /> Request shipping label</RcButton>}
        {selfServe && <p className="text-xs text-rc-muted">Same form our team uses — shipping cost and insured value come preloaded as suggestions you can change.</p>}
        <RcError text={err} />
      </div>
      <div className="rounded-lg border border-rc-line bg-rc-cream/40 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-rc-ink"><MapPin size={14} /> I’ll drop it off</div>
        <p className="mt-2 text-rc-muted">{api.SHOP_ADDRESS.line1}<br />{api.SHOP_ADDRESS.city}<br />{api.SHOP_ADDRESS.hours}</p>
        <RcButton tone="quiet" data-testid="rc-drop-off" disabled={busy} onClick={() => run(() => api.portalDropOff(c.id, e.id))}>I’ll bring it in</RcButton>
      </div>
    </div>
  </RcCard>;
};
