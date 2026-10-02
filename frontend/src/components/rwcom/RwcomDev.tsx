// NOT-KEEPER — dev-only instrumentation for the rw.com emulator. Never part of the production widget; the public site reports to analytics, not to a side panel.
import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as wm8 from '@/api/watchm8';
import type { InstrumentKind } from '@/api/watchm8';

const TABS = ['identify', 'check', 'request'] as const;
const KINDS: InstrumentKind[] = ['shown', 'captured', 'retaken', 'abandoned'];
const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const InstrumentPanel = ({ onClose }: { onClose: () => void }) => {
  const [, tick] = useState(0); useEffect(() => wm8.onInstrument(() => tick((n) => n + 1)), []);
  const log = wm8.instrumentLog();
  const count = (tab: string, kind: InstrumentKind) => log.filter((e) => e.tab === tab && e.kind === kind).length;
  const calls = log.filter((e) => e.kind === 'engine' || e.kind === 'submit' || e.kind === 'handoff');
  return (
    <aside data-testid="instrument-panel" className="w-full shrink-0 rounded-md border border-line bg-surface p-3 text-xs shadow-card lg:w-[360px]">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-semibold text-ink">Instrumentation</span><span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">NOT-KEEPER</span></div>
        <div className="flex items-center gap-1"><button type="button" data-testid="instrument-copy" title="Copy JSON" onClick={() => navigator.clipboard?.writeText(JSON.stringify(log, null, 2)).catch(() => undefined)} className="rounded-sm p-1 text-ink-500 hover:bg-canvas"><Copy size={13} /></button><button type="button" data-testid="instrument-clear" title="Clear" onClick={wm8.clearInstrumentLog} className="rounded-sm p-1 text-ink-500 hover:bg-canvas"><Trash2 size={13} /></button><button type="button" data-testid="instrument-close" onClick={onClose} className="rounded-sm p-1 text-ink-500 hover:bg-canvas"><X size={13} /></button></div></div>
      <p className="mt-1 text-[11px] text-ink-400">Per shot: shown · captured · retaken · abandoned (+ seconds). Mirrored to the console as <span className="font-mono">[wm8]</span> JSON lines.</p>
      <table className="mt-2 w-full border-collapse" data-testid="instrument-counters">
        <thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="py-1 font-medium">Tab</th>{KINDS.map((k) => <th key={k} className="py-1 text-right font-medium">{k}</th>)}</tr></thead>
        <tbody>{TABS.map((t) => <tr key={t} className="border-t border-line"><td className="py-1 capitalize text-ink">{t}</td>{KINDS.map((k) => <td key={k} data-testid={`instr-${t}-${k}`} className="py-1 text-right font-mono text-ink-700">{count(t, k)}</td>)}</tr>)}</tbody>
      </table>
      <div className="mt-3 flex items-baseline justify-between"><span className="font-semibold text-ink">Engine calls</span><span className="text-[10px] text-ink-400">watchm8.ts · mock · {calls.length}</span></div>
      <ol data-testid="instrument-engine" className="mt-1 max-h-72 space-y-1 overflow-y-auto">
        {calls.map((e, i) => { const [method, result] = (e.detail ?? e.kind).split(' → '); return <li key={e.at + i} data-testid={`instr-engine-${i}`} className="rounded-sm bg-canvas px-2 py-1"><div className="flex items-center justify-between gap-2"><span className="font-mono font-medium text-ink">{method}</span><span className="font-mono text-ink-500">{e.ms != null ? `${e.ms} ms` : e.kind}</span></div><div className="text-ink-700">{result ?? '—'}</div><div className="text-[10px] text-ink-400">{e.tab} · {e.device} · {fmt(e.at)}</div></li>; })}
        {!calls.length && <li className="text-ink-400">No engine calls yet — take a photo.</li>}
      </ol>
    </aside>
  );
};
