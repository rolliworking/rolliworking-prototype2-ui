import { useCallback, useEffect, useRef, useState } from 'react';
import type { VerificationPhoto } from '@/api/client';

export type CameraState = 'idle' | 'starting' | 'ready' | 'unavailable' | 'denied';
export interface CameraDevice { deviceId: string; label: string }

const W = 320;
const H = 240;

// deviceId lets a caller pin a specific camera (IPEVO vs microscope); devices lists every video input once permission is granted
export function useCamera(active: boolean, deviceId?: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraState>('idle');
  const [devices, setDevices] = useState<CameraDevice[]>([]);

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
    const video: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId }, width: W, height: H } : { width: W, height: H, facingMode: 'user' };
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
        const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
        if (!cancelled) setDevices(list.filter((d) => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })));
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
  }, [active, deviceId]);

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

  return { videoRef, status, capture, devices };
}
