import clsx from 'clsx';
import { Camera, Check, Plus, Printer, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PackagePhoto } from '@/api/client';
import { CameraPreview } from '@/components/auth/CameraPreview';
import { useCamera } from '@/hooks/useCamera';
import { Button } from '@/components/ui/Button';
import { CONTENT_PILLS } from '@/api/client';

export const ContentPills = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const [custom, setCustom] = useState('');
  const toggle = (pill: string) => onChange(value.includes(pill) ? value.filter((v) => v !== pill) : [...value, pill]);
  const addCustom = () => {
    const v = custom.trim().toLowerCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setCustom('');
  };
  const extras = value.filter((v) => !CONTENT_PILLS.includes(v));
  return (
    <div data-testid="content-pills">
      <div className="flex flex-wrap gap-1.5">
        {[...CONTENT_PILLS, ...extras].map((pill) => {
          const on = value.includes(pill);
          return (
            <button
              key={pill}
              type="button"
              data-testid={`pill-${pill.replace(/\s+/g, '-')}`}
              aria-pressed={on}
              onClick={() => toggle(pill)}
              className={clsx(
                'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color] duration-150',
                on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300',
              )}
            >
              {on && <Check size={12} strokeWidth={3} />} {pill}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          data-testid="pill-custom-input"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Add your own (e.g. spare links)"
          className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none"
        />
        <Button type="button" size="md" data-testid="pill-custom-add" onClick={addCustom} disabled={!custom.trim()}>
          <Plus size={13} /> Add
        </Button>
      </div>
    </div>
  );
};

const readFile = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

export const PhotoCapture = ({ onAdd }: { onAdd: (p: PackagePhoto[]) => void }) => {
  const [camOn, setCamOn] = useState(false);
  const { videoRef, status, capture } = useCamera(camOn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 250);
    return () => clearTimeout(t);
  }, [flash]);

  const snap = () => {
    const shot = capture();
    if (!shot.dataUrl) return;
    setFlash(true);
    onAdd([{ id: `ph-${Date.now().toString(36)}`, source: 'webcam', dataUrl: shot.dataUrl }]);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = await Promise.all(
      Array.from(files).map(async (f, i) => ({ id: `ph-${Date.now().toString(36)}-${i}`, source: 'upload' as const, dataUrl: await readFile(f), fileName: f.name })),
    );
    onAdd(list);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="grid grid-cols-[200px_1fr] gap-3" data-testid="photo-capture">
      <div className={clsx('relative transition-opacity', flash && 'opacity-40')}>
        <CameraPreview videoRef={videoRef} status={status} />
      </div>
      <div className="flex flex-col gap-2">
        {camOn ? (
          <Button type="button" variant="primary" data-testid="photo-snap" onClick={snap} disabled={status !== 'ready'}>
            <Camera size={14} /> Capture photo
          </Button>
        ) : (
          <Button type="button" data-testid="photo-camera-on" onClick={() => setCamOn(true)}>
            <Camera size={14} /> Turn on webcam
          </Button>
        )}
        <Button type="button" data-testid="photo-upload-button" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Upload files…
        </Button>
        <input ref={fileRef} data-testid="photo-upload-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
        <p className="text-[11px] leading-4 text-ink-400">Webcam captures and file uploads both attach to the package. Multiple allowed.</p>
      </div>
    </div>
  );
};

export const ReceiptPreview = ({ lines, onPrint, printed }: { lines: string[]; onPrint: () => void; printed: boolean }) => (
  <div className="rounded-md border border-dashed border-ink-300 bg-surface p-3 font-mono text-[11px] leading-4 text-ink-700" data-testid="receipt-preview">
    <div className="mb-1 text-center text-xs font-semibold tracking-wider text-ink">ROLLISUITE · DROP-OFF RECEIPT</div>
    {lines.map((l, i) => (
      <div key={i}>{l}</div>
    ))}
    <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
      <span className="text-[10px] text-ink-400">Mock print — nothing is sent to a printer</span>
      <Button type="button" size="sm" data-testid="receipt-print" onClick={onPrint}>
        <Printer size={12} /> {printed ? 'Print again' : 'Print receipt'}
      </Button>
    </div>
  </div>
);
