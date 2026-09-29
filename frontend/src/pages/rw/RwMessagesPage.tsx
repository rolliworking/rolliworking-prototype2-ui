import { useCallback, useEffect, useState } from 'react';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { MessageComposer, SentList } from '@/components/layout/MessageComposer';
import { InboxPanel } from '@/components/today/InboxPanel';

// iPad "Messages" tab — my inbox (Done / Claim) + one-shot composer + Sent. No thread.
export default function RwMessagesPage() {
  const { user } = useAuth(); const [inbox, setInbox] = useState<InboxRow[]>([]); const [tick, setTick] = useState(0);
  const load = useCallback(() => { if (user) void hl.getInbox(user.id).then(setInbox); }, [user]);
  useEffect(() => { load(); }, [load, tick]);
  if (!user) return null;
  return <div data-testid="rw-messages-page" className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-2">
    <div><InboxPanel me={user} items={inbox} onChange={() => setTick((t) => t + 1)} jobBase="/rw/jobs" /></div>
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-semibold text-white">Send a message</h2>
      <div className="mt-3"><MessageComposer dark testId="rw-msg" onSent={() => setTick((t) => t + 1)} /></div>
      <h3 className="mt-6 text-base font-semibold text-white">Sent</h3>
      <div className="mt-1"><SentList dark tick={tick} testId="rw-sent" /></div>
    </section>
  </div>;
}
