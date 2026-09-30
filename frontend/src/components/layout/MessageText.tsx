import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import { estDigits } from '@/lib/format';

// Link rule (MH, messaging item 6): RS links open in-app as chips · external URLs → new tab on desktop, plain text + Copy on pads · never unfurled.
const URL_RE = /(https?:\/\/[^\s<>"')]+|(?<![\w/])\/(?:jobs|clients|swo|estimates|intake|concierge|hitlist|appointments|requests|rw)\/[^\s<>"')]+)/g;
const RS_LABEL: Record<string, string> = { jobs: 'Job', clients: 'Client', swo: 'SWO', estimates: 'Estimate', intake: 'Intake', concierge: 'Concierge', hitlist: 'Hitlist', appointments: 'Appointment', requests: 'Request', rw: 'RW' };
const internalPath = (raw: string): string | null => {
  if (raw.startsWith('/')) return raw;
  try { const u = new URL(raw); return u.origin === window.location.origin ? `${u.pathname}${u.search}` : null; } catch { return null; }
};
const chipLabel = (path: string) => { const [, area, id] = path.split('/'); const job = area === 'jobs' && id ? api.wbpForJobSync(id) : null; return `${RS_LABEL[area] ?? area} · ${job ? estDigits(job.jobNumber) : id ? estDigits(id) : ''}`.trim(); };

export const MessageText = ({ text, pad, dark, testId }: { text: string; pad?: boolean; dark?: boolean; testId?: string }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const parts = text.split(URL_RE);
  const chip = dark ? 'bg-accent/15 text-accent hover:bg-accent/25' : 'bg-brand-50 text-brand hover:bg-brand-100';
  return <span data-testid={testId}>{parts.map((p, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
    const path = internalPath(p);
    if (path) return <Link key={i} to={path} data-testid="msg-link-chip" data-path={path} onClick={(e) => e.stopPropagation()} className={`mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-baseline font-mono text-[11px] font-semibold ${chip}`}><Link2 size={10} /> {chipLabel(path)}</Link>;
    const host = p.replace(/^https?:\/\//, '');
    if (pad) return <span key={i} data-testid="msg-link-external" data-mode="copy" className="mx-0.5 inline-flex items-center gap-1 align-baseline"><span className="break-all font-mono text-[11px] opacity-80">{host}</span><button type="button" data-testid="msg-link-copy" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(p); setCopied(p); window.setTimeout(() => setCopied(null), 1500); }} className={`inline-flex min-h-[32px] items-center gap-1 rounded-md border px-2 text-[11px] ${dark ? 'border-white/15 text-slate-200' : 'border-line text-ink-600'}`}><Copy size={11} /> {copied === p ? 'Copied' : 'Copy'}</button></span>;
    return <a key={i} href={p} target="_blank" rel="noopener noreferrer" data-testid="msg-link-external" data-mode="newtab" onClick={(e) => e.stopPropagation()} className={`mx-0.5 inline-flex items-center gap-0.5 break-all align-baseline font-mono text-[11px] underline decoration-dotted ${dark ? 'text-sky-300' : 'text-sky-700'}`}>{host} <ExternalLink size={10} /></a>;
  })}</span>;
};
