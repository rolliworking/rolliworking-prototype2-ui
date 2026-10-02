import clsx from 'clsx';
import { MessageCircle, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { IntercomSection } from '@/components/inbox/IntercomSection';
import { TeamMessages, type TeamChip } from '@/components/layout/TeamMessages';

// iPad "Messages" — the pad mount of Inbox → Team (same list · chips · collapsed Directory · composer) plus the Intercom tab. `?tab=intercom`, `?compose=1`, `?chip=`.
export default function RwMessagesPage() {
  const { user } = useAuth(); const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'intercom' ? 'intercom' : 'team';
  const go = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p); };
  if (!user) return null;
  return <div data-testid="rw-messages-page" data-tab={tab} className="mx-auto max-w-5xl space-y-4 p-5">
    <div data-testid="rw-messages-tabs" className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
      {([['team', 'Team', MessageCircle], ['intercom', 'Intercom', Phone]] as const).map(([k, l, Icon]) => <button key={k} type="button" data-testid={`rw-messages-tab-${k}`} aria-selected={tab === k} onClick={() => go({ tab: k === 'team' ? undefined : k, compose: undefined, chip: undefined })} className={clsx('inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl', tab === k ? 'bg-accent text-[#161b22]' : 'text-slate-300 hover:bg-white/10')}><Icon size={16} /> {l}</button>)}
    </div>
    {tab === 'team' && <TeamMessages me={user} dark pad jobBase="/rw/jobs" chip={(params.get('chip') as TeamChip | null) ?? 'received'} onChip={(c) => go({ chip: c === 'received' ? undefined : c })} compose={params.get('compose') === '1'} onCompose={(o) => go({ compose: o ? '1' : undefined })} />}
    {tab === 'intercom' && <IntercomSection dark pad />}
  </div>;
}
