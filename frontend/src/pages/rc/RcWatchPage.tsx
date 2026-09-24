import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, Receipt, Tag } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { PortalDocument } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcCard, StatusWord, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const DocTile = ({ d }: { d: PortalDocument }) => {
  const [zoom, setZoom] = useState(false);
  if (d.dataUrl) {
    return (
      <>
        <button type="button" data-testid={`rc-doc-${d.id}`} onClick={() => setZoom(true)} className="group overflow-hidden rounded-md border border-rc-line bg-white text-left">
          <img src={d.dataUrl} alt={d.title} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
          <div className="px-2.5 py-2"><div className="truncate text-xs font-medium">{d.title}</div><div className="text-[11px] text-rc-muted">{rcDate(d.at)}</div></div>
        </button>
        {zoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-rc-ink/80 p-6" onClick={() => setZoom(false)} data-testid="rc-doc-zoom">
            <img src={d.dataUrl} alt={d.title} className="max-h-full max-w-full rounded-md bg-white" />
          </div>
        )}
      </>
    );
  }
  const Icon = d.kind === 'estimate' ? FileText : d.kind === 'invoice' ? Receipt : d.kind === 'label' ? Tag : ImageIcon;
  return (
    <Link to={d.path ?? '#'} data-testid={`rc-doc-${d.id}`} className="flex items-center gap-3 rounded-md border border-rc-line bg-white px-3 py-3 hover:border-rc-accent/60">
      <Icon size={18} className="text-rc-accent" />
      <span className="min-w-0"><span className="block truncate text-sm font-medium">{d.title}</span><span className="block text-[11px] text-rc-muted">{rcDate(d.at)}</span></span>
      <ArrowRight size={14} className="ml-auto text-rc-muted" />
    </Link>
  );
};

export default function RcWatchPage() {
  const { id = '' } = useParams();
  const { client } = useRcSession();
  const { data: pw, loading } = useAsync(() => api.portalGetWatch(client!.id, id), [id]);
  if (loading) return null;
  if (!pw) return <p className="text-rc-muted">We couldn’t find that watch on your account.</p>;
  const { watch: w } = pw;
  const photos = pw.documents.filter((d) => d.dataUrl);
  const papers = pw.documents.filter((d) => !d.dataUrl);

  return (
    <div className="space-y-6" data-testid="rc-watch-page">
      <Link to="/rc/home" className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink" data-testid="rc-back-home"><ArrowLeft size={14} /> My watches</Link>
      <div>
        <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">{w.brand} {w.model}</h1>
        <p className="mt-1 text-sm text-rc-muted">Ref. {w.reference} · Serial ending …{w.serial.slice(-4)} · {w.dial} dial · {w.bracelet}</p>
        <div className="mt-4"><StatusWord status={pw.status} size="lg" testId="rc-watch-status" /></div>
        <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-rc-muted">{pw.status.blurb}{pw.eta && pw.status.active ? ` We expect it ready around ${rcDate(pw.eta)}.` : ''}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {pw.openEstimate && <Link to={`/rc/estimates/${pw.openEstimate.id}`} data-testid="rc-watch-estimate-link" className="rounded-full border border-rc-line bg-rc-paper px-4 py-1.5 hover:border-rc-accent/60">Estimate {pw.openEstimate.number} <ArrowRight size={12} className="inline" /></Link>}
          {pw.invoice && <Link to={`/rc/invoices/${pw.invoice.id}`} data-testid="rc-watch-invoice-link" className="rounded-full border border-rc-line bg-rc-paper px-4 py-1.5 hover:border-rc-accent/60">Invoice {pw.invoice.number} <ArrowRight size={12} className="inline" /></Link>}
          <Link to={`/rc/messages?watch=${w.id}`} data-testid="rc-watch-message-link" className="rounded-full border border-rc-line bg-rc-paper px-4 py-1.5 hover:border-rc-accent/60">Ask about this watch</Link>
        </div>
      </div>

      <RcCard eyebrow="Documents & photos" title={`${pw.documents.length} item${pw.documents.length === 1 ? '' : 's'}`} testId="rc-watch-documents">
        {photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((d) => <DocTile key={d.id} d={d} />)}</div>}
        {papers.length > 0 && <div className={`grid gap-2 sm:grid-cols-2 ${photos.length ? 'mt-4' : ''}`}>{papers.map((d) => <DocTile key={d.id} d={d} />)}</div>}
        {pw.documents.length === 0 && <p className="text-[15px] text-rc-muted">Photos and paperwork will appear here as your service progresses.</p>}
      </RcCard>

      <RcCard eyebrow="Service history" title="What’s happened so far" testId="rc-watch-history">
        <ol className="relative border-l border-rc-line pl-5">
          {pw.history.map((h) => (
            <li key={h.id} data-testid={`rc-history-${h.id}`} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-rc-accent" />
              <div className="text-[11px] uppercase tracking-[0.12em] text-rc-muted">{rcDate(h.at)}</div>
              <div className="text-[15px]">{h.path ? <Link to={h.path} className="underline decoration-rc-accent/60 underline-offset-4 hover:decoration-rc-accent">{h.title}</Link> : h.title}</div>
              {h.detail && <div className="text-sm text-rc-muted">{h.detail}</div>}
            </li>
          ))}
          {pw.history.length === 0 && <li className="text-[15px] text-rc-muted">No history yet.</li>}
        </ol>
      </RcCard>
    </div>
  );
}
