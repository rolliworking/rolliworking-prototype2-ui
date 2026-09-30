import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { SwoLabel, SwoWithRefs } from '@/api/client';
import { HealthStrip } from '@/components/concierge/SwoCard';
import { fmtDate } from '@/lib/format';

const COMP: Record<string, string> = { head: 'Head / dial', case: 'Case / bezel', band: 'Bracelet' };
const Tracking = ({ w, label, dir, testId }: { w: SwoWithRefs; label?: SwoLabel; dir: 'outbound' | 'return'; testId: string }) => {
  const st = cz.trackingStatus(w, dir);
  return <div data-testid={testId} className="text-[11px]"><span className="text-ink-400">{dir === 'outbound' ? 'Outbound' : 'Return'}</span> · {label ? <><span className="text-ink-700">{label.carrier}</span> <a href={cz.trackingUrl(label.carrier, label.tracking)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-mono text-brand hover:underline">{label.tracking}<ExternalLink size={9} /></a> · </> : null}<span className={st.live ? 'text-ink' : 'text-ink-500'}>{st.text}</span></div>;
};

// OUTSOURCE / CONCIERGE — information only. Moving a piece to or from a vendor happens on the Concierge board (Assign), never from here.
export const OutsourceInfo = ({ jobId }: { jobId: string }) => {
  const [legs, setLegs] = useState<SwoWithRefs[] | null>(null);
  useEffect(() => { api.getJobVendorLegs(jobId).then(setLegs); }, [jobId]);
  if (!legs) return null;
  if (!legs.length) return <p data-testid="outsource-none" className="text-xs text-ink-400">Not outsourced — nothing on a vendor lane. Sending happens from the Concierge board → Assign.</p>;
  return (
    <ul data-testid="outsource-legs" className="divide-y divide-line/70">
      {legs.map((w) => (
        <li key={w.id} data-testid={`outsource-leg-${w.id}`} data-stage={w.stage} className={`py-2.5 first:pt-0 last:pb-0 ${w.stage === 'fulfilled' ? 'opacity-70' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink">{w.vendor.name}</span>
            {w.international && <span className="inline-flex items-center gap-0.5 rounded-sm bg-sky-50 px-1 text-[10px] font-semibold text-sky-800"><Globe size={9} /> INTL</span>}
            <span className="text-ink-500">{w.components.map((c) => COMP[c] ?? c).join(' + ')}</span>
            <span data-testid={`outsource-stage-${w.id}`} className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">{api.swoStageLabel(w.stage)}</span>
            <span className="text-ink-500">{w.daysOut !== undefined ? `${w.daysOut}d out` : ''}</span>
            <Link to="/concierge" data-testid={`outsource-open-${w.id}`} className="ml-auto font-mono text-[11px] text-brand hover:underline">{w.number} → Concierge</Link>
          </div>
          <div className="mt-1 text-xs text-ink-700">{w.work}</div>
          <div className="mt-1"><HealthStrip w={w} /></div>
          <div className="mt-1 grid grid-cols-[1fr_1fr] gap-x-4 gap-y-0.5">
            <div className="text-[11px] text-ink-500">Expected back <b className="text-ink">{w.predictedCompletion ? fmtDate(w.predictedCompletion) : '—'}</b>{w.sentAt ? ` · sent ${fmtDate(w.sentAt)}` : ''}{w.receivedAt ? ` · received ${fmtDate(w.receivedAt)}` : ''}</div>
            <div className="text-[11px] text-ink-500">Custody <b className="text-ink">{w.custodyHolder}</b></div>
            {w.vendor.ships !== false && <Tracking w={w} label={w.outbound} dir="outbound" testId={`outsource-out-${w.id}`} />}
            {w.vendor.ships !== false && <Tracking w={w} label={w.returnLabel} dir="return" testId={`outsource-return-${w.id}`} />}
          </div>
          {w.vendorReplies[0] && <div className="mt-1 text-[11px] text-ink-500">Last vendor reply · {fmtDate(w.vendorReplies[0].at)} · “{w.vendorReplies[0].text}”</div>}
        </li>
      ))}
    </ul>
  );
};
