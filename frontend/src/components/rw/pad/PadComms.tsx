import clsx from 'clsx';
import { MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { IntercomSection } from '@/components/inbox/IntercomSection';
import { TeamMessages } from '@/components/layout/TeamMessages';

// Pad tab "Page / Message" — the SAME two tabs as Inbox → Team / Intercom, mounted on the pad (one component, two mounts — MH 2026-10-02).
export const PadComms = ({ say }: { say: (t: string, tone?: 'ok' | 'learn' | 'err') => void }) => {
  const { user } = useAuth(); const [tab, setTab] = useState<'team' | 'intercom'>('team'); void say;
  if (!user) return null;
  return <div data-testid="pad-comms" data-tab={tab} className="space-y-4">
    <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
      {([['team', 'Team', MessageCircle], ['intercom', 'Intercom', Phone]] as const).map(([k, l, Icon]) => <button key={k} type="button" data-testid={`pad-comms-tab-${k}`} aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl', tab === k ? 'bg-accent text-[#161b22]' : 'text-slate-300 hover:bg-white/10')}><Icon size={16} /> {l}</button>)}
    </div>
    {tab === 'team' && <TeamMessages me={user} dark pad jobBase="/rw/jobs" />}
    {tab === 'intercom' && <IntercomSection dark pad />}
  </div>;
};
