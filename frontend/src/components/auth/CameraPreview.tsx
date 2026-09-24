import clsx from 'clsx';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import type { RefObject } from 'react';
import type { CameraState } from '@/hooks/useCamera';

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  status: CameraState;
  className?: string;
}

const LABEL: Record<CameraState, string> = {
  idle: 'Camera off',
  starting: 'Starting camera…',
  ready: 'Live · one photo is captured on submit',
  unavailable: 'No camera — sign-in continues, event logged “no camera”',
  denied: 'Camera blocked — sign-in continues, event logged “camera denied”',
};

export const CameraPreview = ({ videoRef, status, className }: Props) => (
  <div className={clsx('overflow-hidden rounded-md border border-line bg-ink', className)} data-testid="camera-preview" data-camera-status={status}>
    <div className="relative aspect-[4/3] w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => undefined)}
        className={clsx('h-full w-full object-cover transition-opacity duration-300', status === 'ready' ? 'opacity-100' : 'opacity-0')}
      />
      {status !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center text-[#93a1b4]">
          {status === 'starting' ? <Loader2 size={22} className="animate-spin" /> : status === 'idle' ? <Camera size={22} /> : <CameraOff size={22} />}
        </div>
      )}
      {status === 'ready' && <span className="absolute left-2 top-2 h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden />}
    </div>
    <div
      data-testid="camera-status-label"
      className={clsx('px-2.5 py-1.5 text-[11px]', status === 'unavailable' || status === 'denied' ? 'bg-amber-50 text-amber-800' : 'bg-ink-700 text-[#c7d0dc]')}
    >
      {LABEL[status]}
    </div>
  </div>
);
