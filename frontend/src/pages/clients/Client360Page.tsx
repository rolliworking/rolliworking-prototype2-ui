import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { ClientHeader } from '@/components/clients/ClientHeader';
import { EstimatesSection, InvoicesSection, JobsSection } from '@/components/clients/RecordSections';
import { EvidenceSection } from '@/components/jobs/EvidencePanel';
import { CustodySection, EmailsSection, NotesTasksSection, RequestsSection } from '@/components/clients/SideSections';
import { TrackButton } from '@/components/shipping/ShippingBits';
import { WatchGroups } from '@/components/clients/WatchGroups';
import { useAsync } from '@/hooks/useAsync';
import { useHitHighlight } from '@/hooks/useHitHighlight';

// Client 360 — the screen that answers the phone. Everything about one client, newest first, every row a link.
export default function Client360Page() {
  const { id = '' } = useParams();
  const { data, loading, reload } = useAsync(() => api.getClient360(id), [id]);
  useHitHighlight(!loading && !!data);

  if (loading) return <div className="text-xs text-ink-400" data-testid="client360-loading">Loading client…</div>;
  if (!data) {
    return (
      <div data-testid="client-not-found" className="text-ink-500">
        Client not found. <Link to="/clients" className="underline">Back to clients</Link>
      </div>
    );
  }

  return (
    <div data-testid="client360-page" className="space-y-4">
      <ClientHeader data={data} />
      <div data-testid="client360-shipments" className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-ink-500">Shipments:</span><TrackButton clientId={data.client.id} testId="client360-track" /></div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 xl:col-span-7">
          <WatchGroups groups={data.watches} />
          <EstimatesSection estimates={data.estimates} />
          <JobsSection jobs={data.jobs} />
          <InvoicesSection salesOrders={data.salesOrders} payments={data.payments} />
          <EvidenceSection clientId={data.client.id} />
        </div>
        <div className="col-span-12 space-y-4 xl:col-span-5">
          <RequestsSection requests={data.requests} watches={data.watches} reload={reload} />
          <NotesTasksSection notes={data.notes} tasks={data.tasks} />
          <CustodySection custody={data.custody} />
          <EmailsSection emails={data.emails} clientId={data.client.id} />
        </div>
      </div>
    </div>
  );
}
