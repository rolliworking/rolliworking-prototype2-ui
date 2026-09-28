import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Address, Client, DeptCode, EstimateLine, QuoteContext, RequestPrefill, Watch } from '@/api/client';
import { ComponentCodeChips } from '@/components/estimates/ComponentChain';
import { Provisional, QuoteContextStrip } from '@/components/estimates/EstimateBits';
import { ClientPicker, EstimateAddresses, EstimateMeta, ShippingCalculator, WatchPicker } from '@/components/estimates/EstimateForm';
import { blankLine, LineEditor } from '@/components/estimates/LineEditor';
import { AddItemButton, MultiItemPanel } from '@/components/estimates/MultiItemBits';
import * as jt from '@/api/jobTemplates';
import { linesFor, newItem, removeItem, type EstimateItem, type ItemFlow } from '@/api/items';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fullName } from '@/lib/format';

const EMPTY: Address = { name: '', street: '', city: '', state: '' };
const plus30 = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

export default function EstimateCreatePage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const requestId = params.get('request') ?? undefined;
  const [prefill, setPrefill] = useState<RequestPrefill | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null); const scanWatch = useRef<Watch | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([newItem('W', 'Watch')]); const [selItem, setSelItem] = useState(() => '');
  const activeItem = items.find((i) => i.id === selItem)?.id ?? items[0].id;
  const [lines, setLines] = useState<EstimateLine[]>([{ ...blankLine(false), itemId: undefined }]);
  const [templates, setTemplates] = useState<jt.JobTemplate[]>([]); useEffect(() => { void jt.getJobTemplates().then(setTemplates); }, []);
  // Lines shown = the selected item's lines; edits merge back without touching other items' lines
  const itemLines = linesFor(lines, items, activeItem);
  const setItemLines = (ls: EstimateLine[]) => setLines((all) => [...all.filter((l) => (l.itemId ?? items[0].id) !== activeItem), ...ls.map((l) => ({ ...l, itemId: activeItem }))]);
  const addItem = (flow: ItemFlow) => { const it = newItem(flow); setItems((v) => [...v, it]); setLines((all) => [...all.map((l) => ({ ...l, itemId: l.itemId ?? items[0].id })), { ...blankLine(false), itemId: it.id }]); setSelItem(it.id); };
  const applyTemplate = (t: jt.JobTemplate) => {
    const tItems = t.items?.length ? t.items.map((x) => newItem(x.flow, x.label)) : [newItem('W', 'Watch')];
    setItems(tItems); setSelItem(tItems[0].id);
    setLines(t.lines.map((l) => ({ ...blankLine(false), description: l.description, dept: l.dept, type: l.type, qty: l.qty, unitPrice: l.unitPrice, itemId: tItems[Math.max(0, (l.item ?? 1) - 1)]?.id ?? tItems[0].id })));
  };
  const [codes, setCodes] = useState<DeptCode[] | null>(null);
  const shownCodes = codes ?? api.inferComponentCodes(lines);
  const [meta, setMeta] = useState({ validUntil: plus30(), clientNotes: '', messageNotes: 'Thank you for your business.', internalNotes: '', billing: EMPTY, shipping: EMPTY, mirror: true });
  const [ctx, setCtx] = useState<QuoteContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { const cid = params.get('client'); const kind = params.get('kind'); const from = params.get('from'); if (!cid) return; void api.getClient(cid).then((c) => { if (c) setClient(c); }); if (kind) setMeta((m) => ({ ...m, internalNotes: `${kind === 'appraisal' ? 'Appraisal' : kind === 'warranty' ? 'Warranty estimate' : kind}${from ? ` — created from ${from}` : ''}`, clientNotes: kind === 'warranty' ? 'Warranty work — no charge unless noted.' : m.clientNotes })); }, [params]);
  useEffect(() => {
    if (!client) return setCtx(null);
    const addr: Address = { name: client.company ? `${client.company} · ${fullName(client)}` : fullName(client), street: client.street, city: client.city, state: client.state };
    setMeta((m) => ({ ...m, billing: addr, shipping: addr }));
    setWatch(scanWatch.current); scanWatch.current = null; // a label scan carries the watch with it
    api.getQuoteContext(client.id, undefined).then(setCtx);
  }, [client]);

  useEffect(() => {
    if (client) api.getQuoteContext(client.id, watch?.id).then(setCtx);
  }, [client, watch]);

  // Origin request → client, watch/description from their message, request linked on save (Q6: request flips to quoted)
  useEffect(() => {
    if (!requestId) return;
    api.getRequestPrefill(requestId).then((p) => { if (p.existingEstimate) { navigate(`/estimates/${p.existingEstimate.id}`, { replace: true }); return; } setPrefill(p); setClient(p.client); setLines([{ ...blankLine(false), description: p.description, dept: 'B' }, blankLine(false)]); setMeta((m) => ({ ...m, clientNotes: p.description, internalNotes: `Origin: request ${p.request.number} (${p.request.source})` })); });
  }, [requestId, navigate]);
  useEffect(() => { if (prefill?.watch && client?.id === prefill.client.id) setWatch(prefill.watch); }, [prefill, client]);

  const save = async (thenSend: boolean) => {
    if (!client) {
      setError('No customer — nothing saved');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const e = await api.createEstimate({ clientId: client.id, watchId: watch?.id, requestId, lines: lines.map((l) => ({ ...l, itemId: items.length > 1 ? l.itemId ?? items[0].id : undefined })), items, components: shownCodes, validUntil: meta.validUntil, clientNotes: meta.clientNotes, messageNotes: meta.messageNotes, internalNotes: meta.internalNotes, billingAddress: meta.billing, shippingAddress: meta.shipping, shippingMirrorsBilling: meta.mirror });
      navigate(`/estimates/${e.id}${thenSend ? '?send=1' : ''}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div data-testid="estimate-create-page" className="space-y-4">
      <Link to="/estimates" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Estimates</Link>
      {prefill && <div data-testid="estimate-origin-request" className="rounded-md border border-moss-200 bg-moss-50 px-3 py-2 text-xs text-moss-800">Creating from request <span className="font-mono font-semibold">{prefill.request.number}</span> · {prefill.client.firstName} {prefill.client.lastName}{prefill.watch && <> · {prefill.watch.brand} {prefill.watch.model}</>} — “{prefill.description}”. Saving links the estimate to the request and marks it quoted.</div>}
      <PageHeader title="New estimate" subtitle="Number is assigned on save · new estimates start as draft" action={<span className="inline-flex items-center gap-1 text-[11px] text-ink-400">Lead link <Provisional note="Optional lead link — no leads module in this prototype" /></span>} />

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="Customer" subtitle="Required to save — no customer, nothing saves" testId="create-customer-card">
            <ClientPicker value={client} onChange={setClient} onResolved={(r) => { scanWatch.current = r.watch?.reference ? r.watch : null; }} />
            {client && <div className="mt-4"><EstimateAddresses billing={meta.billing} shipping={meta.shipping} mirror={meta.mirror} onChange={(p) => setMeta((m) => ({ ...m, ...p }))} /></div>}
            {client && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Watch <span className="font-normal normal-case text-ink-400">optional · existing or new</span></div>
                <WatchPicker clientId={client.id} value={watch} onChange={setWatch} />
              </div>
            )}
          </Card>

          {ctx && client && <QuoteContextStrip clientEstimates={ctx.clientEstimates} watchEstimates={ctx.watchEstimates} clientName={fullName(client)} />}

          <Card title="Lines" subtitle="Pick from the catalog — department tag is inherited; custom lines pick their own" testId="create-lines-card">
            <div className="mb-3 rounded-md border border-line bg-canvas/60 p-2.5"><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Component codes · what we expect in the box</div><ComponentCodeChips value={shownCodes} inferred={codes === null} onToggle={(c) => setCodes(shownCodes.includes(c) ? shownCodes.filter((x) => x !== c) : [...shownCodes, c])} /></div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><label className="inline-flex items-center gap-1 text-ink-500">Start from template<select data-testid="create-template-select" defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) applyTemplate(t); }} className="h-9 rounded-sm border border-line bg-canvas px-2 text-xs"><option value="">— pick a job template —</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.items && t.items.length > 1 ? ` · ${t.items.length} items` : ''}</option>)}</select></label><AddItemButton onAdd={addItem} testId="create-add-item" /><span className="text-[10px] text-ink-400">“Add additional line” (below) = more work on the same piece · “Add Additional Item” = another physical piece</span></div>
            <div className="mb-3"><MultiItemPanel items={items} lines={lines} selected={activeItem} onSelect={setSelItem} onRemove={(id) => { const r = removeItem(lines, items, id); setItems(r.items); setLines(r.lines); if (activeItem === id) setSelItem(r.items[0].id); }} onLabel={(id, label) => setItems((v) => v.map((i) => (i.id === id ? { ...i, label } : i)))} testId="create-items" /></div>
            {items.length > 1 && <div data-testid="create-lines-for-item" className="mb-1 text-[11px] font-semibold text-ink-500">Lines for Item {items.findIndex((i) => i.id === activeItem) + 1} of {items.length}</div>}
            <LineEditor lines={itemLines} onChange={setItemLines} blankTaxableDefault={false} />
            <div className="mt-4"><ShippingCalculator onAddLine={(amount, label) => setLines((ls) => [...ls.filter((l) => l.description.trim() || l.unitPrice), { ...blankLine(false), description: label, unitPrice: amount, type: 'shipping', dept: 'W' }])} /></div>
          </Card>

          <Card title="Details" testId="create-meta-card">
            <EstimateMeta {...meta} onChange={(p) => setMeta((m) => ({ ...m, ...p }))} />
          </Card>
        </div>

        <div>
          <Card title="Save" testId="create-save-card" className="sticky top-0">
            <ul className="mb-3 space-y-1 text-xs text-ink-700">
              <li>{client ? `Customer: ${fullName(client)}` : 'Customer: — required'}</li>
              <li>{watch ? `Watch: ${watch.brand} ${watch.model}` : 'Watch: none (optional)'}</li>
              <li>{lines.filter((l) => l.description.trim() || l.unitPrice).length} line(s) · new blank lines default non-taxable</li>
            </ul>
            {error && <p data-testid="create-error" className="mb-2 text-xs font-medium text-rose-700">{error}</p>}
            <div className="grid gap-2">
              <Button variant="primary" data-testid="create-save-draft" disabled={busy} onClick={() => save(false)}>Save draft</Button>
              <Button data-testid="create-save-send" disabled={busy || !client} onClick={() => save(true)}>Save & review send…</Button>
              <Link to="/estimates" className="text-center text-xs text-ink-500 hover:text-ink">Cancel</Link>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-ink-400">Accepted-by / accepted-date and a local estimate date are not persisted on create <Provisional /></p>
          </Card>
        </div>
      </div>
    </div>
  );
}
