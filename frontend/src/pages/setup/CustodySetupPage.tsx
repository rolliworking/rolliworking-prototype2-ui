import { Link } from 'react-router-dom';
import { CustodyAuditPanel } from '@/components/custody/CustodyAuditPanel';
import { CustodyCoverageCard, UnaccountedList } from '@/components/custody/CustodyCoverage';
import { Card } from '@/components/ui/Card';

// Setup → Custody: start / resume audits (pad + desktop), the unaccounted = −1 list (same list as the chips), found-no-job review, coverage + CSV
export default function CustodySetupPage() {
  return <div data-testid="custody-setup-page" className="space-y-4">
    <div><h1 className="text-xl font-semibold tracking-tight text-ink">Setup → Custody · audit mode</h1><p className="mt-0.5 text-xs text-ink-500">Legacy custody is not trusted. Real custody = physical scans at a node (source audit · backfill · scan). Anything on an open job that was never scanned reveals itself as <b className="text-rose-700">Not on hand · −1 client asset</b> wherever a location is needed. <Link to="/custody" className="text-brand hover:underline">Who holds what →</Link></p></div>
    <Card title="Audit sessions" subtitle="Start audit → pick the node you are standing at (scan its label or tap) → scan every item in it → node ✓ → Close audit. Pause / resume; several people can audit different nodes at once. Also on the Supervisor Pad → Audit → Custody." testId="custody-setup-audit"><CustodyAuditPanel /></Card>
    <Card title="Unaccounted · not on hand (−1)" subtitle="Items on open jobs with no real custody event — from closed audits and from the −1 reveal; fixing one here clears it everywhere" testId="custody-setup-unaccounted"><UnaccountedList /></Card>
    <CustodyCoverageCard />
  </div>;
}
