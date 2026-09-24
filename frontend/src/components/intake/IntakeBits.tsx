import clsx from 'clsx';
import { ScanLine } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import type { PackagePhoto } from '@/api/client';

interface ScanProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit'> {
  label: string;
  hint?: string;
  onScan: (value: string) => void | Promise<void>;
  testId: string;
  error?: string | null;
}

// Scan-gun style field: auto-focus, Enter submits and clears
export const ScanInput = forwardRef<HTMLInputElement, ScanProps>(({ label, hint, onScan, testId, error, className, ...rest }, fwd) => {
  const [value, setValue] = useState('');
  const inner = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof fwd === 'function') fwd(el);
    else if (fwd) fwd.current = el;
  };

  useEffect(() => {
    inner.current?.focus();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    await onScan(value.trim());
    setValue('');
    inner.current?.focus();
  };

  return (
    <form onSubmit={submit} className={className}>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        <ScanLine size={13} /> {label}
      </label>
      <input
        {...rest}
        ref={setRef}
        data-testid={testId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={clsx(
          'h-11 w-full rounded-sm border bg-canvas px-3 font-mono text-[15px] tracking-wide text-ink placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-400 focus:bg-surface focus:outline-none',
          error ? 'border-rose-400' : 'border-line focus:border-ink',
        )}
      />
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className={error ? 'font-medium text-rose-700' : 'text-ink-400'} data-testid={`${testId}-hint`}>
          {error ?? hint ?? 'Type and press Enter to simulate the scan gun'}
        </span>
      </div>
    </form>
  );
});
ScanInput.displayName = 'ScanInput';

export const PhotoStrip = ({ photos, onRemove, size = 'md' }: { photos: PackagePhoto[]; onRemove?: (id: string) => void; size?: 'sm' | 'md' }) => (
  <div className="flex flex-wrap gap-2" data-testid="photo-strip">
    {photos.map((p) => (
      <div key={p.id} className="group relative" data-testid={`photo-${p.id}`}>
        <img src={p.dataUrl} alt={p.fileName ?? 'photo'} className={clsx('rounded-sm object-cover ring-1 ring-line', size === 'sm' ? 'h-10 w-[54px]' : 'h-[72px] w-24')} />
        <span className="absolute bottom-0.5 left-0.5 rounded-sm bg-ink/70 px-1 text-[9px] font-medium uppercase text-white">{p.source}</span>
        {onRemove && (
          <button
            type="button"
            aria-label="Remove photo"
            data-testid={`photo-${p.id}-remove`}
            onClick={() => onRemove(p.id)}
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    ))}
    {photos.length === 0 && <span className="text-xs text-ink-400">No photos yet.</span>}
  </div>
);

export const Stamp = ({ by, station, at }: { by?: string; station?: string; at?: string }) => (
  <span className="text-[11px] text-ink-400">
    {by ?? '—'} · {station ?? '—'}
    {at && ` · ${new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
  </span>
);
