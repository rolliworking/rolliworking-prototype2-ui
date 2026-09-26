import { Camera, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { PortalPhoto, PortalPhotoSections as Sections } from '@/api/client';
import { RcCard, rcDate } from '@/rc/RcBits';

const SECTIONS: { key: keyof Omit<Sections, 'jobNumber'>; title: string; sub: string }[] = [
  { key: 'arrival', title: 'Arrival photos', sub: 'Taken when your watch was checked in' },
  { key: 'condition', title: 'Condition photos', sub: 'Taken during inspection — what we found' },
  { key: 'completed', title: 'Completed', sub: 'Taken when the work was finished' },
];

// Client-facing photos: request → job, labelled sections in timeline order, tap to zoom. Staff-only slots never reach this component.
export const RcPhotoSections = ({ clientId, jobId }: { clientId: string; jobId: string }) => {
  const [s, setS] = useState<Sections | null>(null); const [zoom, setZoom] = useState<PortalPhoto | null>(null);
  useEffect(() => { api.portalGetPhotoSections(clientId, jobId).then(setS); }, [clientId, jobId]);
  useEffect(() => { if (!zoom) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [zoom]);
  if (!s) return null;
  const total = s.arrival.length + s.condition.length + s.completed.length;
  return <RcCard eyebrow="Photos" title={total ? `${total} photo${total === 1 ? '' : 's'} · service ${s.jobNumber}` : 'Photos will appear here as your service progresses'} testId="rc-photo-sections">
    <div className="space-y-6">
      {SECTIONS.map(({ key, title, sub }) => <section key={key} data-testid={`rc-photos-${key}`}>
        <div className="flex items-baseline gap-2"><h3 className="font-serif text-xl">{title}</h3><span className="text-xs text-rc-muted">{sub}</span><span data-testid={`rc-photos-${key}-count`} className="ml-auto text-xs text-rc-muted">{s[key].length || '—'}</span></div>
        {s[key].length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{s[key].map((p) => <button key={p.id} type="button" data-testid={`rc-photo-${p.id}`} onClick={() => setZoom(p)} className="group overflow-hidden rounded-lg border border-rc-line bg-rc-paper text-left"><img src={p.url} alt={p.label} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]" /><div className="px-3 py-2"><div className="text-sm font-medium text-rc-ink">{p.label}</div><div className="text-xs text-rc-muted">{rcDate(p.at)}</div></div></button>)}</div>
          : <p className="mt-2 text-sm text-rc-muted">{key === 'completed' ? 'Not yet — we add these when the work is finished.' : key === 'condition' ? 'Not yet — added after inspection.' : 'None recorded.'}</p>}
      </section>)}
    </div>
    {zoom && <div data-testid="rc-lightbox" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6" onClick={() => setZoom(null)}>
      <button type="button" data-testid="rc-lightbox-close" aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white"><X size={18} /></button>
      <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}><img src={zoom.url} alt={zoom.label} className="max-h-[80vh] w-auto rounded-md" /><figcaption className="mt-3 flex items-center gap-2 text-sm text-white/80"><Camera size={14} /> {zoom.label} · {rcDate(zoom.at)} · service {s.jobNumber}</figcaption></figure>
    </div>}
  </RcCard>;
};
