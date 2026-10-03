import clsx from 'clsx';
import { Check, ImagePlus, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { DeptCode, Division, PackagePhoto, WebRequestResult } from '@/api/client';
import * as wm8 from '@/api/watchm8';
import type { Brand, Leg, ShotKey } from '@/api/watchm8';
import { Choice, DEV, MOCK_BADGE, RwBtn, RwCard, RwField, RwH, rwInput, useDevice } from './RwcomBits';
import { maskSerial, shotList, type RwState } from './rwState';

const BRANDS: Brand[] = ['Rolex', 'Tudor', 'Cellini'];
const CONDITION = ['Runs, but gains or loses time', 'Stopped / won’t wind', 'Crown or stem loose', 'Crystal scratched or cracked', 'Bracelet stretched or loose', 'Moisture or fog inside', 'Cosmetic only — scratches and dings', 'Serviced elsewhere before'];
type Photo = { key: string; dataUrl: string };
const photoTitle = (k: string) => wm8.SHOTS[k as ShotKey]?.title ?? 'Client photo';
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const Done = ({ res, legs, photos, onReset }: { res: WebRequestResult; legs: string[]; photos: Photo[]; onReset: () => void }) => (
  <div className="space-y-5" data-testid="request-done">
    <RwH sub="A person reads every request — expect an estimate or a question within one business day.">Thank you, {res.client.firstName}</RwH>
    <RwCard testId="request-result">
      <div className="flex items-start gap-3"><span className="mt-0.5 rounded-full bg-moss-50 p-1.5 text-moss-700"><Check size={16} /></span><div>
        <div className="text-[15px]">Request <span data-testid="request-number" className="font-mono font-semibold">{res.request.number}</span> is with the team.</div>
        {res.possibleExisting && <div data-testid="request-existing" className="mt-1 text-sm text-rc-muted">Welcome back — we matched this to your existing account by email or phone.</div>}
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-rc-muted">Services</dt><dd data-testid="request-done-legs">{legs.join(', ')}</dd>
          <dt className="text-rc-muted">Photos</dt><dd data-testid="request-done-photos">{photos.length ? `${photos.length} attached · stage 0 · from your phone` : 'none'}</dd>
        </dl>
      </div></div>
    </RwCard>
    <RwCard testId="request-ack-email">
      <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-[0.12em] text-rc-muted">Confirmation email</span>{MOCK_BADGE}</div>
      <div className="mt-2 text-sm"><span className="text-rc-muted">To</span> {res.ackEmail.toName} &lt;{res.ackEmail.to}&gt;</div>
      <div className="text-sm" data-testid="request-ack-subject"><span className="text-rc-muted">Subject</span> {res.ackEmail.subject}</div>
      <pre className="mt-3 whitespace-pre-wrap border-t border-rc-line pt-3 font-sans text-sm leading-relaxed text-rc-ink">{res.ackEmail.body}</pre>
    </RwCard>
    <p className="text-xs text-rc-muted">Emulator only — staff shortcut: <Link to="/requests" data-testid="request-open-staff" className="underline decoration-rc-accent underline-offset-2">Requests page</Link> (lands unowned · source web · no possession yet).</p>
    <RwBtn tone="link" data-testid="request-another" onClick={onReset}>Send another request</RwBtn>
  </div>
);

// REQUEST — structured service submission. Entity (Rolliworks / RolliShop) comes from the host site, never from the visitor; brand boxes are the watch brand.
export const RequestTab = ({ state, update, entity, goTab }: { state: RwState; update: (p: Partial<RwState>) => void; entity: Division; goTab: (t: 'identify' | 'check') => void }) => {
  const device = useDevice();
  const [brand, setBrand] = useState<Brand | undefined>(state.brand); const [legs, setLegs] = useState<Leg[]>([]);
  const [ref, setRef] = useState(state.ref ?? ''); const [model, setModel] = useState(state.model ?? ''); const [bracelet, setBracelet] = useState(state.bracelet ?? ''); const [serial, setSerial] = useState(state.serialPrefix ?? '');
  const [condition, setCondition] = useState<string[]>([]); const [notes, setNotes] = useState(''); const [extra, setExtra] = useState<Photo[]>([]);
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' }); const [handover, setHandover] = useState<'drop_off' | 'ship'>('drop_off');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [result, setResult] = useState<WebRequestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const row = wm8.refByCode(ref); const photos: Photo[] = [...shotList(state.shots), ...extra];
  const legLabels = wm8.LEGS.filter((l) => legs.includes(l.key)).map((l) => l.label);
  // Typical range only once ref + at least one leg are known — blank until then, never "$0"
  const typical = row && legs.length ? wm8.typicalFor(row.ref, legs) : null; const typicalLine = typical && (typical.high > 0 || typical.days > 0) ? wm8.typicalLine(typical) : null;
  const pickRef = (v: string) => { setRef(v); const r = wm8.refByCode(v); if (r) { setModel(r.model); setBrand(r.brand); update({ ref: r.ref, brand: r.brand, model: r.model }); } };
  const addFiles = (files: FileList | null) => { Array.from(files ?? []).forEach((f, i) => { const rd = new FileReader(); rd.onload = () => setExtra((x) => [...x, { key: `upload-${Date.now().toString(36)}-${i}`, dataUrl: String(rd.result) }]); rd.readAsDataURL(f); }); };
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const legDepts: DeptCode[] = Array.from(new Set(wm8.LEGS.filter((l) => legs.includes(l.key)).flatMap((l) => (l.dept ? [l.dept] : []))));
      const pk: PackagePhoto[] = photos.map((p, i) => ({ id: `web-${Date.now().toString(36)}-${i}`, source: 'camera', dataUrl: p.dataUrl, slot: `web-${p.key}`, note: photoTitle(p.key) }));
      const res = await api.submitWebRequest({ brand: entity, legs: legLabels, legDepts, model: [brand, model.trim()].filter(Boolean).join(' ') || undefined, ref: row?.ref ?? (ref.trim() || undefined), serialMasked: serial.trim() ? maskSerial(serial) : undefined, bracelet: bracelet.trim() || undefined, condition, notes: notes.trim() || undefined, photos: pk, firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone.trim() || undefined, handover, typical: typicalLine ?? undefined, claimCode: state.claim });
      wm8.instrument({ tab: 'request', kind: 'submit', device, detail: `submit-web-request → ${res.request.number} · ${res.possibleExisting ? 'existing client' : 'new client'} · ${pk.length} photo(s) · ${api.entityName(entity)}` });
      setResult(res);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(false); }
  };
  if (result) return <Done res={result} legs={legLabels} photos={photos} onReset={() => { setResult(null); setLegs([]); setCondition([]); setNotes(''); setExtra([]); setContact({ firstName: '', lastName: '', email: '', phone: '' }); setHandover('drop_off'); }} />;
  const two = device === 'desktop' ? 'grid-cols-2' : '';

  return (
    <div className="space-y-5" data-testid="request-tab" data-entity={entity}>
      <RwH sub="Tell us about the watch and what it needs. No account required — we email you a code when there’s something to see.">Request service</RwH>
      <RwCard testId="request-brand"><RwField label="Brand"><div className="grid grid-cols-3 gap-2">{BRANDS.map((b) => <Choice key={b} big testId={`request-brand-${b}`} on={brand === b} onClick={() => { setBrand(b); update({ brand: b }); }}>{b}</Choice>)}</div></RwField></RwCard>
      <RwCard testId="request-legs">
        <RwField label="What does it need?" hint="Pick everything that applies"><div className={clsx('grid gap-2', device === 'desktop' ? 'grid-cols-3' : 'grid-cols-2')}>{wm8.LEGS.map((l) => <Choice key={l.key} testId={`request-leg-${l.key}`} on={legs.includes(l.key)} onClick={() => setLegs(toggle(legs, l.key))}>{l.label}{l.dept && <span className="ml-1 text-[10px] opacity-60">{l.dept}</span>}</Choice>)}</div></RwField>
        <p data-testid="request-typical" data-state={typicalLine ? 'shown' : 'blank'} className="mt-3 min-h-5 text-sm text-rc-muted">{typicalLine && <>{typicalLine} <span className="text-xs">· a range, not a quote</span></>}</p>
      </RwCard>
      <RwCard testId="request-watch">
        <div className={clsx('grid gap-4', two)}>
          <RwField label="Reference" hint={row ? `${row.brand} ${row.model}` : undefined}><input data-testid="request-ref" list="wm8-refs-req" value={ref} onChange={(e) => pickRef(e.target.value)} placeholder="e.g. 16233" className={clsx(rwInput, 'font-mono')} /><datalist id="wm8-refs-req">{wm8.REFS.map((r) => <option key={r.ref} value={r.ref}>{r.brand} {r.model}</option>)}</datalist></RwField>
          <RwField label="Model"><input data-testid="request-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Datejust 36" className={rwInput} /></RwField>
          <RwField label="Bracelet"><input data-testid="request-bracelet" value={bracelet} onChange={(e) => setBracelet(e.target.value)} placeholder="Jubilee · Oyster · strap" className={rwInput} /></RwField>
          <RwField label="Serial prefix" hint={serial.trim() ? `We store it as ${maskSerial(serial)}` : 'Masked — we keep only the first characters'}><input data-testid="request-serial" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. L or 6.1" className={clsx(rwInput, 'font-mono')} /></RwField>
        </div>
        <p className="mt-3 text-xs text-rc-muted">Not sure? <RwBtn tone="link" className="min-h-0 text-xs" data-testid="request-go-identify" onClick={() => goTab('identify')}>Identify it from a photo</RwBtn> · <RwBtn tone="link" className="min-h-0 text-xs" data-testid="request-go-check" onClick={() => goTab('check')}>Check the dial &amp; bezel</RwBtn></p>
      </RwCard>
      <RwCard testId="request-condition">
        <RwField label="Condition" hint="Tick what you’ve noticed"><div className={clsx('grid gap-2', two)}>{CONDITION.map((c, i) => <Choice key={c} testId={`request-cond-${i}`} on={condition.includes(c)} onClick={() => setCondition(toggle(condition, c))}>{c}</Choice>)}</div></RwField>
        <div className="mt-3"><RwField label="Anything else"><textarea data-testid="request-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="History, what changed, what you’d like back" className={clsx(rwInput, 'h-auto py-2')} /></RwField></div>
      </RwCard>
      <RwCard testId="request-photos">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-xs font-medium uppercase tracking-[0.12em] text-rc-muted">Photos</span><span data-testid="request-photo-count" data-count={photos.length} className="text-sm">{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} attached from your phone` : 'Optional — a dial photo helps'}</span></div>
        {photos.length > 0 && <div data-testid="request-photo-strip" className="mt-2 flex flex-wrap gap-2">{photos.map((p) => <figure key={p.key} data-testid={`request-photo-${p.key}`}><img src={p.dataUrl} alt={photoTitle(p.key)} className="h-16 w-20 rounded-md object-cover ring-1 ring-rc-line" /><figcaption className="mt-0.5 text-[10px] text-rc-muted">{photoTitle(p.key)}</figcaption></figure>)}</div>}
        <p className="mt-2 text-xs text-rc-muted">Attached exactly as taken — stage 0 · your phone · uncontrolled light. We re-photograph everything in the shop.</p>
        <div className="mt-2 flex flex-wrap gap-2"><RwBtn tone="quiet" className="min-h-9 text-xs" data-testid="request-add-photo" onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> Add a photo</RwBtn>{DEV && <RwBtn tone="quiet" className="min-h-9 text-xs" data-testid="request-add-placeholder" title="Dev build only" onClick={() => setExtra((x) => [...x, { key: `extra-${x.length + 1}`, dataUrl: wm8.ph('Client photo · placeholder') }])}>Placeholder (dev)</RwBtn>}</div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </RwCard>
      <RwCard testId="request-contact">
        <div className={clsx('grid gap-4', two)}>
          <RwField label="First name"><input data-testid="request-first" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} className={rwInput} autoComplete="given-name" /></RwField>
          <RwField label="Last name"><input data-testid="request-last" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} className={rwInput} autoComplete="family-name" /></RwField>
          <RwField label="Email"><input data-testid="request-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={rwInput} autoComplete="email" /></RwField>
          <RwField label="Mobile (optional)" hint="For a text when there’s news"><input data-testid="request-phone" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="(212) 555-0100" className={rwInput} autoComplete="tel" /></RwField>
        </div>
        <div className="mt-4"><RwField label="How will the watch reach us?"><div className="grid grid-cols-2 gap-2"><Choice big testId="request-handover-drop_off" on={handover === 'drop_off'} onClick={() => setHandover('drop_off')}>Drop off<span className="mt-0.5 block text-xs opacity-70">At the shop — we’ll suggest times</span></Choice><Choice big testId="request-handover-ship" on={handover === 'ship'} onClick={() => setHandover('ship')}>Ship it<span className="mt-0.5 block text-xs opacity-70">Insured label from us</span></Choice></div></RwField></div>
      </RwCard>
      {err && <p data-testid="request-error" className="text-sm text-rose-700">{err}</p>}
      <div className="flex flex-wrap items-center gap-3"><RwBtn data-testid="request-submit" disabled={busy} onClick={() => void submit()}><Send size={15} /> {busy ? 'Sending…' : 'Send request'}</RwBtn><span className="text-xs text-rc-muted">Goes to the {api.entityName(entity)} team {MOCK_BADGE}</span></div>
    </div>
  );
};
