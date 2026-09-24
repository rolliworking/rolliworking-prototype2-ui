import { Plus, Search, UserRound, Watch as WatchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { Address, Client, Watch } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { fullName } from '@/lib/format';
import { Provisional } from './EstimateBits';

export const ClientPicker = ({ value, onChange }: { value: Client | null; onChange: (c: Client) => void }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Client[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const t = setTimeout(() => api.searchClients(q).then(setHits), 120);
    return () => clearTimeout(t);
  }, [q]);

  const create = async () => {
    try {
      const c = await api.createClient(draft);
      onChange(c);
      setCreating(false);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create client');
    }
  };

  if (value) {
    return (
      <div data-testid="client-selected" className="flex items-center justify-between rounded-sm border border-line bg-canvas px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-brand"><UserRound size={13} /></span>
          <div><div className="text-[13px] font-medium text-ink">{fullName(value)}</div><div className="text-[11px] text-ink-500">{value.email} · {value.phone}</div></div>
        </div>
        <button type="button" data-testid="client-change" onClick={() => onChange(null as unknown as Client)} className="text-xs text-brand hover:underline">Change</button>
      </div>
    );
  }
  return (
    <div>
      {creating ? (
        <div data-testid="client-new-form" className="grid grid-cols-2 gap-2 rounded-sm border border-line p-3">
          <input data-testid="client-new-first" placeholder="First name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" autoFocus />
          <input data-testid="client-new-last" placeholder="Last name" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
          <input data-testid="client-new-email" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
          <input data-testid="client-new-phone" placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
          {err && <p className="col-span-2 text-xs text-rose-700">{err}</p>}
          <div className="col-span-2 flex gap-2"><Button size="sm" variant="primary" data-testid="client-new-save" onClick={create}>Create client</Button><Button size="sm" onClick={() => setCreating(false)}>Cancel</Button></div>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input data-testid="client-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client by name, email, phone…" className="h-9 w-full rounded-sm border border-line bg-canvas pl-8 pr-2 text-[13px] focus:border-ink focus:bg-surface focus:outline-none" />
          {(hits.length > 0 || q.trim()) && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md bg-surface p-1 shadow-pop animate-rise">
              {hits.map((c) => (
                <li key={c.id}><button type="button" data-testid={`client-hit-${c.id}`} onClick={() => onChange(c)} className="flex w-full justify-between rounded-sm px-2.5 py-1.5 text-left text-[13px] hover:bg-canvas"><span className="text-ink">{fullName(c)}</span><span className="text-xs text-ink-400">{c.email}</span></button></li>
              ))}
              <li><button type="button" data-testid="client-new-toggle" onClick={() => setCreating(true)} className="flex w-full items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-left text-xs text-brand hover:bg-canvas"><Plus size={12} /> New client{q.trim() && ` “${q.trim()}”`}</button></li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export const WatchPicker = ({ clientId, value, onChange }: { clientId: string; value: Watch | null; onChange: (w: Watch | null) => void }) => {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ brand: 'Rolex' as 'Rolex' | 'Tudor', model: '', reference: '', serial: '', partNumber: '' });
  useEffect(() => {
    api.getWatchesForClient(clientId).then(setWatches);
  }, [clientId]);

  const add = async () => {
    const w = await api.createWatch(clientId, draft);
    setWatches((prev) => [...prev, w]);
    onChange(w);
    setAdding(false);
  };

  return (
    <div data-testid="watch-picker">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" data-testid="watch-none" onClick={() => onChange(null)} className={`h-8 rounded-sm border px-2.5 text-xs ${!value ? 'border-ink bg-ink text-white' : 'border-line text-ink-500 hover:border-ink-300'}`}>No watch yet</button>
        {watches.map((w) => (
          <button key={w.id} type="button" data-testid={`watch-option-${w.id}`} onClick={() => onChange(w)} className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs ${value?.id === w.id ? 'border-ink bg-ink text-white' : 'border-line text-ink-700 hover:border-ink-300'}`}>
            <WatchIcon size={12} /> {w.brand} {w.model} <span className="font-mono opacity-70">{w.reference}</span> <StatusPill status={w.status} />
          </button>
        ))}
        <button type="button" data-testid="watch-add-toggle" onClick={() => setAdding((a) => !a)} className="inline-flex h-8 items-center gap-1 rounded-sm border border-dashed border-ink-300 px-2.5 text-xs text-brand hover:border-ink"><Plus size={12} /> New watch</button>
      </div>
      {adding && (
        <div data-testid="watch-new-form" className="mt-2 grid grid-cols-5 gap-2 rounded-sm border border-line p-3">
          <select data-testid="watch-new-brand" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value as 'Rolex' | 'Tudor' })} className="h-8 rounded-sm border border-line bg-canvas px-1 text-[13px]"><option>Rolex</option><option>Tudor</option></select>
          <input data-testid="watch-new-model" placeholder="Model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
          <input data-testid="watch-new-ref" placeholder="Reference" value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 font-mono text-[13px]" />
          <input data-testid="watch-new-serial" placeholder="Serial (or NS)" value={draft.serial} onChange={(e) => setDraft({ ...draft, serial: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 font-mono text-[13px]" />
          <input data-testid="watch-new-part" placeholder="Part # (optional)" value={draft.partNumber} onChange={(e) => setDraft({ ...draft, partNumber: e.target.value })} className="h-8 rounded-sm border border-line bg-canvas px-2 font-mono text-[13px]" />
          <div className="col-span-5"><Button size="sm" variant="primary" data-testid="watch-new-save" onClick={add}>Add watch</Button></div>
        </div>
      )}
    </div>
  );
};

interface NotesProps {
  validUntil: string; clientNotes: string; messageNotes: string; internalNotes: string;
  billing: Address; shipping: Address; mirror: boolean; readOnly?: boolean;
  onChange: (patch: Partial<{ validUntil: string; clientNotes: string; messageNotes: string; internalNotes: string; billing: Address; shipping: Address; mirror: boolean }>) => void;
}

const AddrFields = ({ a, onChange, testId, disabled }: { a: Address; onChange: (a: Address) => void; testId: string; disabled?: boolean }) => (
  <div className="grid gap-1.5">
    <input data-testid={`${testId}-name`} disabled={disabled} value={a.name} onChange={(e) => onChange({ ...a, name: e.target.value })} placeholder="Name" className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] disabled:text-ink-500" />
    <input data-testid={`${testId}-street`} disabled={disabled} value={a.street} onChange={(e) => onChange({ ...a, street: e.target.value })} placeholder="Street" className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] disabled:text-ink-500" />
    <div className="grid grid-cols-[1fr_64px] gap-1.5">
      <input data-testid={`${testId}-city`} disabled={disabled} value={a.city} onChange={(e) => onChange({ ...a, city: e.target.value })} placeholder="City" className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] disabled:text-ink-500" />
      <input data-testid={`${testId}-state`} disabled={disabled} value={a.state} onChange={(e) => onChange({ ...a, state: e.target.value.toUpperCase() })} placeholder="ST" className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] uppercase disabled:text-ink-500" />
    </div>
  </div>
);

export const EstimateMeta = ({ validUntil, clientNotes, messageNotes, internalNotes, billing, shipping, mirror, readOnly, onChange }: NotesProps) => (
  <div className="grid grid-cols-2 gap-4" data-testid="estimate-meta">
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Valid until</label>
        <input type="date" data-testid="valid-until" disabled={readOnly} value={validUntil.slice(0, 10)} onChange={(e) => onChange({ validUntil: new Date(e.target.value + 'T12:00:00').toISOString() })} className="h-8 rounded-sm border border-line bg-canvas px-2 text-[13px]" />
        <span className="ml-2 text-[11px] text-ink-400">default today + 30</span>
      </div>
      <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Client notes</label><textarea data-testid="client-notes" disabled={readOnly} rows={2} value={clientNotes} onChange={(e) => onChange({ clientNotes: e.target.value })} placeholder="What the client told us" className="w-full rounded-sm border border-line bg-canvas px-2 py-1.5 text-[13px]" /></div>
      <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Message on estimate</label><input data-testid="message-notes" disabled={readOnly} value={messageNotes} onChange={(e) => onChange({ messageNotes: e.target.value })} className="h-8 w-full rounded-sm border border-line bg-canvas px-2 text-[13px]" /></div>
      <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Internal notes <span className="font-normal normal-case text-ink-400">staff only</span></label><textarea data-testid="internal-notes" disabled={readOnly} rows={2} value={internalNotes} onChange={(e) => onChange({ internalNotes: e.target.value })} className="w-full rounded-sm border border-amber-200 bg-amber-50/40 px-2 py-1.5 text-[13px]" /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Billing</div><AddrFields a={billing} onChange={(a) => onChange({ billing: a })} testId="billing" disabled={readOnly} /></div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">Shipping <label className="inline-flex items-center gap-1 font-normal normal-case tracking-normal"><input type="checkbox" data-testid="shipping-mirror" disabled={readOnly} checked={mirror} onChange={(e) => onChange({ mirror: e.target.checked })} className="accent-ink" /> same as billing</label></div>
        <AddrFields a={mirror ? billing : shipping} onChange={(a) => onChange({ shipping: a })} testId="shipping" disabled={readOnly || mirror} />
      </div>
    </div>
  </div>
);

export const ShippingCalculator = ({ onAddLine }: { onAddLine?: (amount: number, label: string) => void }) => {
  const [units, setUnits] = useState(5);
  const [hiAk, setHiAk] = useState(false);
  const [sat, setSat] = useState(false);
  const r = api.calcShipping({ units, hiAk, saturday: sat });
  return (
    <div data-testid="shipping-calc" className="rounded-sm border border-dashed border-amber-300 bg-amber-50/30 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2 font-semibold text-ink-700">Shipping calculator (display) <Provisional note="Legacy calculator — not written on save" /></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5">Insurance units <input type="number" min={0} data-testid="ship-units" value={units} onChange={(e) => setUnits(Number(e.target.value))} className="h-7 w-16 rounded-sm border border-line bg-surface px-1.5 text-right" /></label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" data-testid="ship-hiak" checked={hiAk} onChange={(e) => setHiAk(e.target.checked)} className="accent-ink" /> HI / AK +30</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" data-testid="ship-sat" checked={sat} onChange={(e) => setSat(e.target.checked)} className="accent-ink" /> Saturday +20</label>
        <span className="text-ink-500">base 35 · {r.overnight ? 'overnight +25 (units > 25)' : 'no overnight'} · insured value ${r.insuredValue.toLocaleString()}</span>
        <span className="ml-auto tabular font-semibold text-ink" data-testid="ship-amount">${r.amount.toFixed(2)}</span>
        {onAddLine && <Button size="sm" data-testid="ship-add-line" onClick={() => onAddLine(r.amount, `Insured shipping (${units} units${hiAk ? ', HI/AK' : ''}${sat ? ', Saturday' : ''})`)}>Add as shipping line</Button>}
      </div>
    </div>
  );
};
