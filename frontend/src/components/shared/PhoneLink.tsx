import clsx from 'clsx';
import { Phone } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import * as tel from '@/api/telephony';

// Click-to-call: every phone number on client / job records is tappable → originates from the signed-in user's extension (Vonage mock) and logs like any call
export const PhoneLink = ({ number, clientId, jobId, className, testId, mono = true }: { number: string; clientId?: string; jobId?: string; className?: string; testId?: string; mono?: boolean }) => {
  const [err, setErr] = useState<string | null>(null);
  const dial = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); try { tel.dial({ clientId, number, jobId }); } catch (x) { setErr(x instanceof Error ? x.message : 'Could not dial'); window.setTimeout(() => setErr(null), 2500); } };
  return <span className="inline-flex items-center gap-1.5">
    <button type="button" data-testid={testId ?? 'phone-link'} onClick={dial} title="Call from your extension (click-to-call · Vonage mock)" className={clsx('inline-flex items-center gap-1.5 rounded-sm text-left hover:text-brand hover:underline', mono && 'font-mono', className)}><Phone size={13} className="text-ink-400" />{number}</button>
    {err && <span data-testid="phone-link-error" className="text-[11px] text-rose-700">{err}</span>}
  </span>;
};
