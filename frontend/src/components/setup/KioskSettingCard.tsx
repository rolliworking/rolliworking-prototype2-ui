import { Camera } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import { Card } from '@/components/ui/Card';

// Admin control-panel toggle — OFF: kiosk still takes ad-hoc photos; ON: the guided 4-step set becomes a required bench task on W-routed jobs
export const KioskSettingCard = () => {
  const [on, setOn] = useState(api.kioskRequiredSetting());
  return <Card title="Watchmaker-room photo kiosk" subtitle="Shared common-area station · microscope + IPEVO · no per-user login" testId="setup-kiosk-card" action={<Link to="/wm-kiosk" data-testid="setup-kiosk-open" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Camera size={12} /> Open kiosk</Link>}>
    <label className="flex items-start gap-3 text-[13px] text-ink">
      <input type="checkbox" data-testid="setup-kiosk-required" checked={on} onChange={(e) => void api.setKioskRequired(e.target.checked).then(setOn)} className="mt-0.5 h-4 w-4 accent-ink" />
      <span><span className="font-semibold">Require watchmaker-room photo documentation</span><span data-testid="setup-kiosk-state" className={`ml-2 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold ${on ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500'}`}>{on ? 'ON' : 'OFF'}</span>
        <span className="mt-0.5 block text-xs text-ink-500">ON → every W-routed item needs the 4-step set (dial front · dial back · movement back · case back) at the kiosk before the job clears; shows as a task on the assigned watchmaker’s bench iPad and the WM-room supervisor’s team view. OFF → the kiosk still works for ad-hoc photos with @-mentions; the guided set never triggers.</span>
        <span className="mt-1 block text-[11px] text-amber-800">Open: hard gate on completion vs soft compliance tracking · every W item vs only dial-separated ones · camera per step is a proposed default.</span></span>
    </label>
  </Card>;
};
