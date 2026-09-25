import { useCallback, useEffect, useState, type ReactNode } from 'react';

export const field = 'rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-ink-300 focus:outline-none';
export const downloadCsv = (name: string, csv: string) => { const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = name; a.click(); };

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => fn().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed')), deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  const run = async (action: () => Promise<unknown>, okMsg?: string) => { try { setError(null); await action(); await reload(); if (okMsg) setMsg(okMsg); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); }, [msg]);
  return { data, error, msg, reload, run, setError };
}

export const Flash = ({ error, msg }: { error: string | null; msg: string | null }) => (
  <>
    {error && <div data-testid="rs-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
    {msg && <div data-testid="rs-msg" className="rounded-md border border-moss-200 bg-moss-50 px-3 py-2 text-xs text-moss-700">{msg}</div>}
  </>
);

export const Tabs = ({ tabs, active, onChange, prefix }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void; prefix: string }) => (
  <div className="flex gap-1 border-b border-line">
    {tabs.map((t) => <button key={t.key} data-testid={`${prefix}-tab-${t.key}`} onClick={() => onChange(t.key)} className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${active === t.key ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-500 hover:text-ink'}`}>{t.label}{t.count !== undefined && <span className="ml-1 rounded-full bg-canvas px-1.5 text-[10px] text-ink-500">{t.count}</span>}</button>)}
  </div>
);

export const Head = ({ title, sub, action }: { title: string; sub: ReactNode; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1><p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-xs text-ink-500">{sub}</p></div>{action}</div>
);
