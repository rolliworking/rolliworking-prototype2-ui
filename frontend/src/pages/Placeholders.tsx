import { Construction, Lock } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { NAV_ITEMS, QUICK_ACTIONS, findNavItem, type NavItem, type QuickAction } from '@/config/navigation';
import { PageHeader } from '@/components/ui/Button';

const Placeholder = ({ item }: { item: NavItem | QuickAction }) => {
  const Icon = item.icon;
  return (
    <div data-testid={`placeholder-${item.key}`} className="animate-rise">
      <PageHeader title={item.label} subtitle={item.blurb} />
      <div className="grid h-[320px] place-items-center rounded-md border border-dashed border-ink-300/70 bg-surface/60">
        <div className="text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-canvas text-ink-400">
            <Icon size={18} strokeWidth={1.8} />
          </span>
          <div className="mt-3 text-[13px] font-semibold text-ink">{item.label} isn’t built in this prototype yet</div>
          <div className="mt-1 inline-flex items-center gap-1 text-xs text-ink-400">
            <Construction size={12} /> Placeholder route · {item.path}
          </div>
        </div>
      </div>
    </div>
  );
};

export function SectionPlaceholder() {
  const { pathname } = useLocation();
  const item = findNavItem(pathname) ?? NAV_ITEMS[0];
  return <Placeholder item={item} />;
}

export function ActionPlaceholder() {
  const { action = '' } = useParams();
  const item = QUICK_ACTIONS.find((a) => a.key === action);
  if (!item) return <NotFound />;
  return <Placeholder item={item} />;
}

export function RestrictedPage({ label }: { label: string }) {
  return (
    <div data-testid="restricted-page" className="grid h-[60vh] place-items-center">
      <div className="text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-amber-800">
          <Lock size={18} />
        </span>
        <div className="mt-3 text-[13px] font-semibold text-ink">{label} isn’t available for your access tier</div>
        <p className="mt-1 text-xs text-ink-400">Ask a manager if you need something from this section.</p>
        <Link to="/" className="mt-4 inline-block text-xs font-medium text-brand hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div data-testid="not-found-page" className="grid h-[60vh] place-items-center text-center">
      <div>
        <div className="font-mono text-3xl font-semibold text-ink-300">404</div>
        <div className="mt-2 text-[13px] text-ink-500">That page doesn’t exist.</div>
        <Link to="/" className="mt-3 inline-block text-xs font-medium text-brand hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
