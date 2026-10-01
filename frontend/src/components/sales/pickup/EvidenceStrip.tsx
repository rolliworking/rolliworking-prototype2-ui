import clsx from 'clsx';
import { Film } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { PickupSession, SalesOrderWithRefs } from '@/api/client';
import { useCamera } from '@/hooks/useCamera';
import { DEV, cameraPrefs, placeholderShot } from './PickupBits';

export interface Capture { soId: string; number: string; startedAt: number; mine: boolean; session: PickupSession }
// ?fast=1 (dev builds only) compresses the 60 s strip into 6 s — same capture + append path, just a shorter interval
const frameInterval = () => (DEV && new URLSearchParams(window.location.search).get('fast') === '1' ? 1000 : api.PICKUP_FRAME_WINDOW_MS / api.PICKUP_FRAMES);

// Owns the client camera AFTER Done: frames 2..6 for every capture started at this station; shows other stations' pending strips read-only
export const useEvidenceCapture = () => {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const load = useCallback(() => api.getOpenEvidenceCaptures().then((rows) => setCaptures((cur) => {
    const mine = new Set(cur.filter((c) => c.mine).map((c) => c.soId));
    const next = rows.map((r) => ({ soId: r.order.id, number: r.order.number, startedAt: new Date(r.session.evidenceStartedAt ?? r.session.at).getTime(), mine: mine.has(r.order.id), session: r.session }));
    const finished = cur.filter((c) => c.mine && !rows.some((r) => r.order.id === c.soId)).map((c) => ({ ...c }));
    return [...next, ...finished.slice(0, 2)];
  })), []);
  useEffect(() => { void load(); return api.onPickupEvent(() => void load()); }, [load]);
  const start = useCallback((o: SalesOrderWithRefs) => { if (o.pickupSession) setCaptures((cur) => [{ soId: o.id, number: o.number, startedAt: Date.now(), mine: true, session: o.pickupSession! }, ...cur.filter((c) => c.soId !== o.id)]); }, []);
  return { captures, start, reload: load };
};

export const EvidenceStrip = ({ captures, reload }: { captures: Capture[]; reload: () => void }) => {
  const active = captures.some((c) => c.mine && c.session.evidenceStatus === 'pending');
  const { videoRef, status, capture } = useCamera(active, cameraPrefs().client);
  const busy = useRef(false);
  useEffect(() => {
    if (!active) return;
    const every = frameInterval();
    const t = setInterval(async () => {
      if (busy.current) return; busy.current = true;
      try {
        for (const c of captures.filter((x) => x.mine && x.session.evidenceStatus === 'pending')) {
          const have = c.session.frames?.length ?? 0; if (have >= api.PICKUP_FRAMES) continue;
          if (Date.now() - c.startedAt < have * every) continue; // frame n is due at startedAt + (n-1)·interval
          let shot = capture().dataUrl; if (!shot && DEV) shot = placeholderShot(`CLIENT CAM · frame ${have + 1}/6 · +${have * (every / 1000)}s`).dataUrl;
          if (!shot) continue; // dead camera: nothing arrives → the 90 s sweep flags it INCOMPLETE and pins MH
          await api.pickupAppendFrame(c.soId, shot);
        }
      } catch { /* order finished elsewhere */ } finally { busy.current = false; reload(); }
    }, Math.min(every, 1000));
    return () => clearInterval(t);
  }, [active, captures, capture, reload]);
  useEffect(() => { const t = setInterval(reload, 15_000); return () => clearInterval(t); }, [reload]);
  if (captures.length === 0) return null;
  return (
    <div data-testid="evidence-strip" className="fixed bottom-3 left-[260px] right-6 z-30 rounded-md border border-line bg-surface/95 px-3 py-2 shadow-pop backdrop-blur">
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-ink-500"><Film size={12} /> Evidence capture</span>
        {active && <video ref={videoRef} autoPlay muted playsInline className={clsx('h-8 w-11 rounded-sm bg-black object-cover', status !== 'ready' && 'opacity-30')} data-testid="evidence-cam" data-status={status} />}
        <ul className="flex flex-1 flex-wrap gap-4">
          {captures.map((c) => { const n = c.session.frames?.length ?? 0; const st = c.session.evidenceStatus ?? 'pending'; return (
            <li key={c.soId} data-testid={`evidence-${c.soId}`} data-frames={n} data-status={st} className="flex items-center gap-2">
              <Link to={`/sales/${c.soId}`} className="font-mono font-medium text-ink hover:underline">{c.number}</Link>
              <span className="flex gap-0.5">{Array.from({ length: api.PICKUP_FRAMES }, (_, i) => <i key={i} className={clsx('block h-2 w-2 rounded-full', i < n ? (st === 'incomplete' ? 'bg-rose-500' : 'bg-moss-600') : 'bg-line')} />)}</span>
              <span className={clsx('text-[11px]', st === 'complete' ? 'text-moss-800' : st === 'incomplete' ? 'font-semibold text-rose-700' : 'text-ink-500')}>{n}/{api.PICKUP_FRAMES} · {st === 'pending' ? (c.mine ? 'recording' : `pending at ${c.session.station}`) : st}</span>
            </li>); })}
        </ul>
      </div>
    </div>
  );
};
