import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { QuickAddProvider } from '@/components/today/QuickAddOverlay';

export const PrototypeBanner = () => (
  <div
    data-testid="prototype-banner"
    className="flex h-6 shrink-0 items-center justify-center bg-amber-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800"
  >
    Prototype — fake data
  </div>
);

export default function AppShell() {
  return (
    <QuickAddProvider>
      <div className="flex h-full flex-col">
        <PrototypeBanner />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main data-testid="main-content" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </QuickAddProvider>
  );
}
