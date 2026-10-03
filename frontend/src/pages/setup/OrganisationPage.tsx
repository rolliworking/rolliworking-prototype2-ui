import clsx from 'clsx';
import { Building2, GitBranch, Layers, MonitorSmartphone, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { DepartmentsTab } from '@/components/setup/org/DepartmentsTab';
import { EntitiesTab } from '@/components/setup/org/EntitiesTab';
import { OrgTreeTab } from '@/components/setup/org/OrgTreeTab';
import { StaffTab } from '@/components/setup/org/StaffTab';
import { StationsTab } from '@/components/setup/org/StationsTab';
import { PageHeader } from '@/components/ui/Button';

const TABS = [
  { key: 'entities', label: 'Entities', icon: Building2 },
  { key: 'departments', label: 'Departments', icon: Layers },
  { key: 'stations', label: 'Stations', icon: MonitorSmartphone },
  { key: 'tree', label: 'Org tree', icon: GitBranch },
  { key: 'staff', label: 'Staff', icon: Users },
] as const;
type TabKey = (typeof TABS)[number]['key'];

// Setup → Organisation (D-495…D-497): entities · departments · stations · org tree · staff — the tables the rest of the app reads instead of hardcoded names
export default function OrganisationPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'staff') as TabKey;
  const [flash, setFlash] = useState<{ m: string; err: boolean } | null>(null);
  const say = (m: string, err = false) => { setFlash({ m, err }); window.setTimeout(() => setFlash(null), 3500); };
  if (user?.accessTier !== 'manager') return <div data-testid="org-restricted" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Setup → Organisation needs a manager.</div>;
  return <div data-testid="organisation-page" className="space-y-4">
    <PageHeader title="Organisation & staff" subtitle="Entities · departments · stations · org tree · staff — one source the whole app reads. Names here replace every hardcoded “Rolliworks / RolliShop”." action={<Link to="/setup" data-testid="org-back" className="text-xs text-brand hover:underline">← Setup</Link>} />
    <div className="flex items-center gap-1 border-b border-line" data-testid="org-tabs">{TABS.map((t) => <button key={t.key} type="button" data-testid={`org-tab-${t.key}`} onClick={() => setParams({ tab: t.key })} className={clsx('-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-xs font-medium', tab === t.key ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink')}><t.icon size={13} /> {t.label}</button>)}</div>
    {flash && <div data-testid="org-flash" className={clsx('rounded-sm px-3 py-1.5 text-xs font-medium', flash.err ? 'bg-rose-50 text-rose-700' : 'bg-moss-50 text-moss-700')}>{flash.m}</div>}
    {tab === 'entities' && <EntitiesTab onFlash={say} />}
    {tab === 'departments' && <DepartmentsTab onFlash={say} />}
    {tab === 'stations' && <StationsTab onFlash={say} />}
    {tab === 'tree' && <OrgTreeTab />}
    {tab === 'staff' && <StaffTab onFlash={say} />}
  </div>;
}
