import { useEffect, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';

interface Props {
  length?: number;
  onSubmit: (pin: string) => Promise<void>;
  autoFocus?: boolean;
  testId?: string;
  compact?: boolean;
}

export const PinInput = ({ length = 4, onSubmit, autoFocus = true, testId = 'pin-input', compact }: Props) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = async (value: string) => {
    if (value.length !== length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incorrect PIN');
      setPin('');
      setBusy(false);
      ref.current?.focus();
    }
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    setPin(digits);
    if (digits.length === length) void submit(digits);
  };

  const onForm = (e: FormEvent) => {
    e.preventDefault();
    void submit(pin);
  };

  return (
    <form onSubmit={onForm} className={clsx(!compact && 'space-y-2')}>
      <div className="relative">
        <input
          ref={ref}
          data-testid={testId}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => onChange(e.target.value)}
          placeholder="PIN"
          aria-label="4-digit PIN"
          disabled={busy}
          className="sr-only"
        />
        <div className="flex gap-2" onClick={() => ref.current?.focus()} role="presentation">
          {Array.from({ length }).map((_, i) => (
            <span
              key={i}
              className={clsx(
                'grid h-11 w-10 place-items-center rounded-sm border bg-canvas font-mono text-lg transition-colors',
                i === pin.length && !busy ? 'border-ink' : 'border-line',
                error && 'border-rose-400',
              )}
            >
              {pin[i] ? '•' : ''}
            </span>
          ))}
        </div>
      </div>
      {error && (
        <p data-testid={`${testId}-error`} className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
      {!compact && <p className="text-[11px] text-ink-400">Type your 4-digit PIN — submits automatically. Prototype PIN: 1234</p>}
    </form>
  );
};
