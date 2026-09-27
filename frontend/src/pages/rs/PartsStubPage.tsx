import { Boxes, ExternalLink, PackageSearch, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';

// Placeholder — flagged, not built: there is no parts-catalog home yet. Pieces live in Purchasing (vendor ↔ part), Inventory (stock) and the approval / quick-add flows.
export default function PartsStubPage() {
  return <div data-testid="parts-stub-page" className="max-w-3xl space-y-4">
    <div><h1 className="text-xl font-semibold tracking-tight text-ink">Parts</h1><p className="mt-0.5 text-xs text-ink-500">Parts catalog — coming soon. Scoped as its own build; nothing invented here.</p></div>
    <Card title="Not built yet — what a Parts home would own" testId="parts-stub-card">
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700"><li>Part # · description · aliases (today: learned in <Link to="/parts/knowledge" className="text-brand hover:underline">Parts Knowledge</Link>)</li><li>Cost, vendor links and vendor part numbers (today: on PO lines in <Link to="/purchasing" className="text-brand hover:underline">Purchasing</Link>)</li><li>Min / order-up-to and stock by location (today: <Link to="/inventory" className="text-brand hover:underline">Inventory</Link>)</li><li>Where a part is used: parts-approval + quick-add flows on jobs</li></ul>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link to="/inventory" data-testid="parts-stub-inventory" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 font-medium text-ink hover:bg-canvas"><Boxes size={13} /> Open Inventory (stock & locations)</Link>
        <Link to="/purchasing" data-testid="parts-stub-purchasing" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 font-medium text-ink hover:bg-canvas"><PackageSearch size={13} /> Open Purchasing (vendor ↔ part on POs)</Link>
        <Link to="/parts/knowledge" data-testid="parts-stub-knowledge" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 font-medium text-ink hover:bg-canvas"><Tag size={13} /> Parts Knowledge <ExternalLink size={11} className="text-ink-400" /></Link>
      </div>
    </Card>
  </div>;
}
