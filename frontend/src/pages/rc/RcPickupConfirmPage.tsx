import { CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard } from '@/rc/RcBits';

const mmss = (iso: string) => { const s = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Reverse-QR confirm screen — the client's phone opens this from the QR the STATION shows. Public (tokened, single-use, 10 min). Rendered as a route and inline inside the station's mock phone.
export const RcPickupConfirm = ({ token, embedded }: { token: string; embedded?: boolean }) => {
  const [data, setData] = useState<api.PortalPickupConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const load = () => api.portalGetPickupConfirm(token).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const act = (fn: () => Promise<api.PortalPickupConfirm>) => fn().then(setData).catch((e) => setError(e.message));
  const expired = data && data.state === 'open' && new Date(data.expiresAt).getTime() < Date.now();
  return (
    <div data-testid="rc-pickup-confirm" data-state={expired ? 'expired' : data?.state ?? (error ? 'error' : 'loading')} className={embedded ? 'p-4' : 'mx-auto max-w-[520px] pt-6'}>
      <RcCard eyebrow="Pickup" title={<span className="inline-flex items-center gap-2"><ShieldCheck size={20} className="text-rc-accent" /> Confirm it’s you</span>}>
        {error && <p data-testid="rc-pickup-error" className="text-[15px] text-rose-700">{error}</p>}
        {data && (
          <div className="space-y-4 text-[15px] leading-relaxed">
            <p>Hi {data.clientFirstName} — someone at <b>{data.station}</b> is collecting your <b>{data.watchLabel}</b> ({data.soNumber}). Is that you, or someone you sent?</p>
            {data.state === 'open' && !expired && (
              <>
                <p className="inline-flex items-center gap-1.5 text-rc-muted"><Clock size={14} /> This link works once and expires in <span data-testid="rc-pickup-countdown" className="font-mono">{mmss(data.expiresAt)}</span>.</p>
                <div className="flex flex-col gap-2">
                  <RcButton data-testid="rc-pickup-yes" onClick={() => act(() => api.portalConfirmPickup(token))}>Yes — release my watch</RcButton>
                  <RcButton tone="danger" data-testid="rc-pickup-no" onClick={() => act(() => api.portalDeclinePickup(token))}>That’s not me</RcButton>
                </div>
              </>
            )}
            {data.state === 'confirmed' && <p data-testid="rc-pickup-done" className="inline-flex items-center gap-2 text-moss-800"><CheckCircle2 size={18} /> Confirmed. The counter can hand your watch over now — thank you.</p>}
            {data.state === 'declined' && <p data-testid="rc-pickup-declined" className="inline-flex items-center gap-2 text-rose-700"><XCircle size={18} /> We’ve stopped the hand-over and alerted the shop. Nobody receives your watch.</p>}
            {(data.state === 'expired' || expired) && <p data-testid="rc-pickup-expired" className="text-rc-muted">This link expired. Ask the counter to show a fresh QR.</p>}
            {data.state === 'used' && <p className="text-rc-muted">This link was already used.</p>}
            <p className="text-xs text-rc-muted">{data.shop}</p>
          </div>
        )}
      </RcCard>
    </div>
  );
};

export default function RcPickupConfirmPage() {
  const { token = '' } = useParams();
  return <RcPickupConfirm token={token} />;
}
