import { Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { JobWithRefs } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { useSwoBase } from '@/components/concierge/SwoBits';
import { SwoForm } from '@/pages/rs/SwoPage';

// Job detail → "New SWO": open a box for a vendor (or drop the ticket into one still In queue), then land on the hub page. A job can ride several lanes over its life, one at a time.
export const SendToVendorButton = ({ job, onDone }: { job: JobWithRefs; onDone: (m: string) => void }) => {
  const [open, setOpen] = useState(false); const nav = useNavigate(); const base = useSwoBase();
  return <>
    <Button size="sm" data-testid="job-send-to-vendor" onClick={() => setOpen(true)}><Truck size={12} /> New SWO</Button>
    {open && <SwoForm init={{ jobId: job.id, components: [job.components[0]?.key ?? 'head'] }} onClose={() => setOpen(false)} onSaved={(m, hubId) => { setOpen(false); onDone(m); nav(`${base}/${hubId}`); }} />}
  </>;
};
// Back action to the board at the same expanded lane / stage
export const ConciergeBackBar = () => {
  const { state } = useLocation() as { state?: { from?: string } };
  if (!state?.from?.startsWith('/concierge')) return null;
  return <Link to={state.from} data-testid="concierge-back-link" className="inline-flex items-center gap-1 rounded-sm border border-line bg-canvas px-2 py-1 text-xs font-medium text-ink-700 hover:border-ink-300">← Back to Concierge board</Link>;
};
