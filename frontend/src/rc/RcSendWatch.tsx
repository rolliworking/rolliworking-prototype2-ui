import { Check, MapPin, Package } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { Address, EstimateWithRefs } from '@/api/client';
import { RcButton, RcCard, RcError, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const Field = ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) => <div><RcLabel htmlFor={id}>{label}</RcLabel><input id={id} data-testid={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-rc-line bg-rc-paper px-3 py-2 text-[15px] outline-none focus:border-rc-ink" /></div>;

// "Send us your watch" — front and center on the estimate page. The client's own tap creates the Label Requests row (stage 1 of the inbound board).
export const RcSendWatch = ({ estimate: e, onChange }: { estimate: EstimateWithRefs; onChange: () => void }) => {
  const { client } = useRcSession(); const c = client!;
  const [addr, setAddr] = useState<Address>({ name: `${c.firstName} ${c.lastName}`, street: c.street, city: c.city, state: c.state }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); setBusy(true); try { await fn(); onChange(); } catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong'); } finally { setBusy(false); } };
  if (e.sendIntent) return <RcCard eyebrow="Sending your watch" testId="rc-send-confirmed">
    <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check size={16} /></span>
      <div className="text-[15px] leading-relaxed">{e.sendIntent.kind === 'label' ? <><span className="font-medium">Label requested.</span> We are preparing a prepaid, insured shipping label and will email it shortly. Pack the watch in its box or a padded pouch — the label covers the declared value.</> : <><span className="font-medium">See you soon.</span> Bring the watch to {api.SHOP_ADDRESS.line1}, {api.SHOP_ADDRESS.city}. {api.SHOP_ADDRESS.hours}. No appointment needed; ask for the service desk.</>}</div></div>
  </RcCard>;
  return <RcCard eyebrow="Send us your watch" title="Ready when you are" testId="rc-send-watch">
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <p className="text-[15px] text-rc-muted">Confirm your pickup address and we will email a prepaid, insured shipping label.</p>
        <Field id="rc-addr-name" label="Name" value={addr.name} onChange={(v) => setAddr({ ...addr, name: v })} />
        <Field id="rc-addr-street" label="Street" value={addr.street} onChange={(v) => setAddr({ ...addr, street: v })} />
        <div className="grid grid-cols-[1fr_90px] gap-3"><Field id="rc-addr-city" label="City" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} /><Field id="rc-addr-state" label="State" value={addr.state} onChange={(v) => setAddr({ ...addr, state: v.toUpperCase().slice(0, 2) })} /></div>
        <RcButton data-testid="rc-request-label" disabled={busy} onClick={() => run(() => api.portalRequestLabel(c.id, e.id, addr))}><Package size={16} /> Request shipping label</RcButton>
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
