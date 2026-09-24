import { ArrowLeft, FilePlus2, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Client360 } from '@/api/client';
import { fmtDate, fmtMoneyCents, fullName, humanize, relativeTime } from '@/lib/format';

const Stat = ({ label, value, tone, testId }: { label: string; value: string | number; tone?: 'warn' | 'ok'; testId: string }) => (
  <div data-testid={testId} className="min-w-[84px]">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
    <div className={`tabular text-[15px] font-semibold leading-5 ${tone === 'warn' ? 'text-rose-700' : tone === 'ok' ? 'text-moss-700' : 'text-ink'}`}>{value}</div>
  </div>
);

// Sticky identity strip — what you need to say "hi Naomi" and know where things stand before she finishes the sentence
export const ClientHeader = ({ data }: { data: Client360 }) => {
  const { client, summary } = data;
  return (
    <header data-testid="client360-header" className="sticky top-0 z-10 -mx-6 -mt-5 border-b border-line bg-surface/95 px-6 pb-3 pt-3 shadow-card backdrop-blur">
      <Link to="/clients" className="mb-1 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink" data-testid="client360-back">
        <ArrowLeft size={12} /> Clients
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-ink" data-testid="client360-name">{fullName(client)}</h1>
            {client.company && <span className="text-sm text-ink-500">{client.company}</span>}
            <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink-500">{humanize(client.type)} · since {new Date(client.since).getFullYear()}</span>
            <span className="text-[11px] text-ink-400">ID {client.id}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-700" data-testid="client360-contact">
            <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail size={13} className="text-ink-400" /> {client.email}</a>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs"><Phone size={13} className="text-ink-400" /> {client.phone}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-ink-400" /> {client.street}, {client.city}, {client.state}</span>
            {summary.lastContactAt && <span className="text-xs text-ink-400">last contact {relativeTime(summary.lastContactAt)} · {fmtDate(summary.lastContactAt)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <Stat label="Watches" value={`${summary.watchCount} · ${summary.inHouse} in house`} testId="stat-watches" />
          <Stat label="Open estimates" value={summary.openEstimates} testId="stat-open-estimates" />
          <Stat label="Active jobs" value={summary.activeJobs} testId="stat-active-jobs" />
          <Stat label="Requests" value={summary.openRequests} testId="stat-open-requests" />
          <Stat label="Tasks" value={summary.openTasks} testId="stat-open-tasks" />
          <Stat label="Balance due" value={fmtMoneyCents(summary.openBalance)} tone={summary.openBalance > 0 ? 'warn' : 'ok'} testId="stat-balance" />
          <Stat label="Lifetime paid" value={fmtMoneyCents(summary.lifetimeSpend)} testId="stat-lifetime" />
          <Link to="/estimates/new" data-testid="client360-new-estimate" className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink-700">
            <FilePlus2 size={13} /> New estimate
          </Link>
        </div>
      </div>
    </header>
  );
};
