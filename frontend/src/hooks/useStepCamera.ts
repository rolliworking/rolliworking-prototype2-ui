import { useEffect, useState } from 'react';
import { MOCK_CAMERAS } from '@/components/inspection/InspectionCameraFlow';
import { useCamera } from '@/hooks/useCamera';

export type StepCam = 'ipevo' | 'microscope';
export const isScope = (l: string) => /hy-?3307|microscope|scope/i.test(l);
export const isIpevo = (l: string) => /ipevo|v4k/i.test(l);
export const camKind = (label: string, fallback: StepCam): StepCam => (isScope(label) ? 'microscope' : isIpevo(label) ? 'ipevo' : fallback);
export const placeholderFrame = (label: string, cam: string) => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d')!; g.fillStyle = cam === 'ipevo' ? '#1f2630' : '#0e3b4a'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(label, 16, 90); g.fillText(`${cam} · no camera`, 16, 112); return c.toDataURL('image/jpeg', 0.6); };

// Shared dual-camera plumbing (microscope + IPEVO): device enumeration, per-step auto-switch, manual override that resets when the step changes
export function useStepCamera(stepCam: StepCam, stepKey: string) {
  const [manual, setManual] = useState<string | null>(null); const [devId, setDevId] = useState<string | undefined>();
  const cam = useCamera(true, devId);
  const cams = cam.devices.length ? cam.devices : MOCK_CAMERAS;
  const auto = cams.find((d) => (stepCam === 'ipevo' ? isIpevo(d.label) : isScope(d.label))) ?? cams[stepCam === 'ipevo' ? 0 : Math.min(1, cams.length - 1)];
  const active = (manual && cams.find((d) => d.deviceId === manual)) || auto;
  useEffect(() => { setManual(null); }, [stepKey]);
  useEffect(() => { setDevId(active.deviceId.startsWith('mock-') ? undefined : active.deviceId); }, [active.deviceId]);
  return { ...cam, cams, active, manual, setManual };
}
