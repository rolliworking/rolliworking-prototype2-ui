import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerificationPhoto } from '@/api/client';

export type CameraState = 'idle' | 'starting' | 'ready' | 'unavailable' | 'denied';

const W = 320;
const H = 240;

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraState>('idle');

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;
    setStatus('starting');
    navigator.mediaDevices
      .getUserMedia({ video: { width: W, height: H, facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  const capture = useCallback((): VerificationPhoto => {
    const v = videoRef.current;
    if (status !== 'ready' || !v || v.videoWidth === 0) {
      return { dataUrl: null, cameraStatus: status === 'denied' ? 'denied' : 'no_camera' };
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.getContext('2d')!.drawImage(v, 0, 0, W, H);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.7), cameraStatus: 'captured' };
  }, [status]);

  return { videoRef, status, capture };
}
