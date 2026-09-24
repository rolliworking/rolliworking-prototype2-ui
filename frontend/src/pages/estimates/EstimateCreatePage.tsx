import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { Address, Client, EstimateLine, QuoteContext, Watch } from '@/api/client';
import { Provisional, QuoteContextStrip } from '@/components/estimates/EstimateBits';
import { ClientPicker, EstimateMeta, ShippingCalculator, WatchPicker } from '@/components/estimates/EstimateForm';
import { blankLine, LineEditor } from '@/components/estimates/LineEditor';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fullName } from '@/lib/format';

const EMPTY: Address = { name: '', street: '', city: '', state: '' };
const plus30 = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

export default function EstimateCreatePage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);
  const [lines, setLines] = useState<EstimateLine[]>([blankLine(false)]);
  const [meta, setMeta] = useState({ validUntil: plus30(), clientNotes: '', messageNotes: 'Thank you for your business.', internalNotes: '', billing: EMPTY, shipping: EMPTY, mirror: true });
  const [ctx, setCtx] = useState<QuoteContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) return setCtx(null);
    const addr: Address = { name: client.company ? `${client.company} · ${fullName(client)}` : fullName(client), street: client.street, city: client.city, state: client.state };
    setMeta((m) => ({ ...m, billing: addr, shipping: addr }));
    setWatch(null);
    api.getQuoteContext(client.id, undefined).then(setCtx);
  }, [client]);

  useEffect(() => {
    if (client) api.getQuoteContext(client.id, watch?.id).then(setCtx);
  }, [client, watch]);

  const save = async (thenSend: boolean) => {
    if (!client) {
      setError('No customer — nothing saved');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const e = await api.createEstimate({ clientId: client.id, watchId: watch?.id, lines, validUntil: meta.validUntil, clientNotes: meta.clientNotes, messageNotes: meta.messageNotes, internalNotes: meta.internalNotes, billingAddress: meta.billing, shippingAddress: meta.shipping, shippingMirrorsBilling: meta.mirror });
      navigate(`/estimates/${e.id}${thenSend ? '?send=1' : ''}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div data-testid="estimate-create-page" className="space-y-4">
      <Link to="/estimates" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Estimates</Link>
      <PageHeader title="New estimate" subtitle="Number is assigned on save · new estimates start as draft" action={<span className="inline-flex items-center gap-1 text-[11px] text-ink-400">Lead link <Provisional note="Optional lead link — no leads module in this prototype" /></span>} />

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="Customer" subtitle="Required to save — no customer, nothing saves" testId="create-customer-card">
            <ClientPicker value={client} onChange={setClient} />
            {client && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Watch <span className="font-normal normal-case text-ink-400">optional · existing or new</span></div>
                <WatchPicker clientId={client.id} value={watch} onChange={setWatch} />
              </div>
            )}
          </Card>

          {ctx && client && <QuoteContextStrip clientEstimates={ctx.clientEstimates} watchEstimates={ctx.watchEstimates} clientName={fullName(client)} />}

          <Card title="Lines" subtitle="Pick from the catalog — department tag is inherited; custom lines pick their own" testId="create-lines-card">
            <LineEditor lines={lines} onChange={setLines} blankTaxableDefault={false} />
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
