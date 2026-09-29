import { useEffect, useRef, useState } from 'react';

// Camera lookup on the pad: live rear-camera preview + BarcodeDetector where WebKit offers it; otherwise the wedge scanner / keypad stays the path. NOT-KEEPER: decode quality is device-dependent.
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;
export const CameraLookup = ({ onCode }: { onCode: (code: string) => void }) => {
  const video = useRef<HTMLVideoElement>(null); const [state, setState] = useState<string>('starting camera…'); const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null; let timer: number | null = null; let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    (async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); if (stop) return; if (video.current) { video.current.srcObject = stream; await video.current.play(); } }
      catch (e) { setState(`Camera unavailable — ${e instanceof Error ? e.name : 'error'} · type the number or use the wedge scanner`); return; }
      if (!Ctor) { setState('Camera on · this WebKit has no BarcodeDetector — hold the label to the wedge scanner or type it'); return; }
      const det = new Ctor({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'] }); setState('Camera on · point at the label');
      const tick = async () => { if (stop || !video.current) return; try { const hits = await det.detect(video.current); const v = hits[0]?.rawValue; if (v && v !== last) { setLast(v); onCode(v); setState(`Read ${v}`); } } catch { /* frame not ready */ } timer = window.setTimeout(() => void tick(), 350); };
      void tick();
    })();
    return () => { stop = true; if (timer) window.clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div data-testid="camera-lookup" className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-black/40 p-2">
    <video ref={video} playsInline muted className="h-28 w-40 rounded-sm bg-black object-cover" data-testid="camera-lookup-video" />
    <div className="text-xs text-slate-300" data-testid="camera-lookup-state">{state}</div>
  </div>;
};
