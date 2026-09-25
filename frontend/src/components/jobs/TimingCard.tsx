import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { TimingTest } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { TimingHistory } from '@/pages/rt/RtTestPage';

export const TimingCard = ({ jobId, watchId, status }: { jobId: string; watchId: string; status: string }) => {
  const [tests, setTests] = useState<TimingTest[]>([]);
  useEffect(() => { api.getTimingTests({ watchId }).then(setTests); }, [watchId, status]);
  return <Card title="Timing tests (RolliTime)" subtitle={`${tests.filter((t) => t.jobId === jobId).length} on this job · ${tests.length} on this watch · newest first`} action={status === 'testing' ? <Link data-testid="job-open-rollitime" to={`/rt/test/${jobId}`} className="text-xs text-brand hover:underline">Open in RolliTime →</Link> : undefined} testId="job-timing-card"><TimingHistory tests={tests} compact /></Card>;
};
