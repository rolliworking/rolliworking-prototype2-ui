import { Database, Lock, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import * as wm8 from '@/api/watchm8Export';
import type { Wm8Env, Wm8Seam } from '@/api/watchm8Export';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Flash, Head } from '@/components/rs/RsBits';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

const Switch = ({ on, disabled, testId, onClick }: { on: boolean; disabled?: boolean; testId: string; onClick?: () => void }) => (
  <button type="button" data-testid={testId} role="switch" aria-checked={on} disabled={disabled} onClick={onClick} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-moss' : 'bg-ink-200'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

// Setup → Integrations → WatchM8. The export switch is the KILL SWITCH: per environment, default OFF, prod owner-only + agreement ref. Specimen is the only exportable class. MOCK end to end.
export default function Wm8SetupPage() {
  const [s, setS] = useState<Wm8Seam | null>(null); const [refs, setRefs] = useState<Record<Wm8Env, string>>({ prod: '', staging: '', dev: '' }); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { wm8.getWm8Seam().then((x) => { setS(x); setRefs({ prod: x.settings.envs.prod.agreementRef, staging: x.settings.envs.staging.agreementRef, dev: x.settings.envs.dev.agreementRef }); }); }, []);
  const run = async (f: () => Promise<Wm8Seam>, ok?: string) => { try { setErr(null); setS(await f()); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (!s) return null;
  const cur = s.settings.envs[s.current]; const anyOn = wm8.WM8_ENVS.some((e) => s.settings.envs[e.key].enabled);
  return <div data-testid="wm8-setup-page" className="space-y-4">
    <Head title="WatchM8 corpus feed" sub={<><Link to="/integrations" className="text-brand hover:underline">Integrations</Link> → WatchM8 · <span className="rounded bg-amber-50 px-1 font-semibold text-amber-800">MOCKED</span> — nothing leaves the browser <Provisional note="Keeper owns the real push; this page is the control surface it must honour: per-env kill switch, class policy, append-only export log" /></>}
      action={<span data-testid="wm8-overall" data-on={anyOn} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${anyOn ? 'bg-moss-50 text-moss-700' : 'bg-ink/90 text-white'}`}>{anyOn ? 'a switch is ON' : 'all switches OFF — nothing has left'}</span>} />
    <Flash error={err} msg={msg} />

    <Card title="Export switch · per environment" subtitle="Default OFF everywhere. Production is owner-only and cannot turn ON without a signed agreement ref. Staging / dev: manager tier." testId="wm8-switches" bodyClassName="p-0">
      <ul className="divide-y divide-line">{wm8.WM8_ENVS.map((e) => { const row = s.settings.envs[e.key]; const can = s.canToggle[e.key]; const isCur = s.current === e.key; return <li key={e.key} data-testid={`wm8-env-${e.key}`} data-on={row.enabled} data-current={isCur} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
        <Switch on={row.enabled} disabled={!can} testId={`wm8-switch-${e.key}`} onClick={() => void run(() => wm8.setWm8Switch(e.key, !row.enabled, refs[e.key]), `${e.label} export ${row.enabled ? 'OFF' : 'ON'}`)} />
        <div className="w-40"><div className="font-medium text-ink">{e.label}{isCur && <span data-testid="wm8-current-badge" className="ml-1 rounded-sm bg-canvas px-1 text-[9px] font-semibold uppercase tracking-wide text-ink-500 ring-1 ring-line">this app</span>}</div><div className="text-[11px] text-ink-500">{e.blurb}</div></div>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-500">Agreement ref<input data-testid={`wm8-ref-${e.key}`} value={refs[e.key]} disabled={!can} onChange={(ev) => setRefs({ ...refs, [e.key]: ev.target.value })} onBlur={() => { if (refs[e.key] !== row.agreementRef) void run(() => wm8.setWm8AgreementRef(e.key, refs[e.key]), 'Agreement ref saved'); }} placeholder={e.key === 'prod' ? 'required before ON' : 'optional'} className="h-7 w-44 rounded-sm border border-line bg-canvas px-2 font-mono text-xs disabled:opacity-50" /></label>
        <span className="font-mono text-[11px] text-ink-500">licence {row.licenceVersion}</span>
        <span data-testid={`wm8-env-state-${e.key}`} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${row.enabled ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500 ring-1 ring-line'}`}>{row.enabled ? 'ON' : 'OFF'}</span>
        <span className="ml-auto text-[11px] text-ink-400">{row.changedAt ? `${row.changedBy} · ${fmtDate(row.changedAt)} ${fmtTime(row.changedAt)}` : 'never changed'}{!can && <span data-testid={`wm8-locked-${e.key}`} className="ml-2 inline-flex items-center gap-1"><Lock size={10} /> {e.key === 'prod' ? 'owner only' : 'manager tier'}</span>}</span>
      </li>; })}</ul>
    </Card>

    <div className="grid grid-cols-2 gap-3">
      <Card title="Classes that may leave" subtitle="Policy, not preference — only specimen is a setting. Operational and identity are locked OFF." testId="wm8-classes">
        <ul className="space-y-2">{api.PHOTO_CLASSES.map((c) => { const pol = wm8.WM8_CLASS_POLICY[c.key]; const on = s.settings.classes[c.key]; return <li key={c.key} data-testid={`wm8-class-${c.key}`} data-on={on} data-locked={!pol.exportable} className={`flex items-start gap-3 text-xs ${pol.exportable ? '' : 'opacity-60'}`}>
          <Switch on={on} disabled={!pol.exportable || !s.isManager} testId={`wm8-class-switch-${c.key}`} onClick={() => void run(() => wm8.setWm8Class(c.key, !on), `${c.label} ${on ? 'excluded' : 'included'}`)} />
          <div><div className="font-medium text-ink">{c.label}{!pol.exportable && <span className="ml-1 inline-flex items-center gap-1 rounded-sm bg-canvas px-1 text-[9px] font-semibold uppercase tracking-wide text-ink-500 ring-1 ring-line"><Lock size={9} /> never exportable</span>}</div><div className="text-[11px] text-ink-500">{pol.why}</div></div>
        </li>; })}</ul>
      </Card>
      <Card title="Candidate corpus" subtitle="What WOULD go out from this app's environment when its switch is ON" testId="wm8-candidates">
        <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-ink-500">This app runs as</dt><dd className="flex items-center gap-2"><select data-testid="wm8-current-env" value={s.current} onChange={(e) => void run(() => wm8.setWm8CurrentEnv(e.target.value as Wm8Env), 'Environment switched (prototype control)')} className="h-7 rounded-sm border border-line bg-canvas px-1.5 text-xs">{wm8.WM8_ENVS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select><span className="text-[10px] text-ink-400">NOT-KEEPER · rehearses the prod guard</span></dd>
          <dt className="text-ink-500">Switch</dt><dd data-testid="wm8-current-state" data-on={cur.enabled} className={cur.enabled ? 'font-semibold text-moss-700' : 'font-semibold text-ink-600'}>{cur.enabled ? 'ON' : 'OFF — nothing leaves'}</dd>
          <dt className="text-ink-500">Opinion labels</dt><dd data-testid="wm8-cand-labels" className="tabular">{s.candidates.labels}</dd>
          <dt className="text-ink-500">Specimen photos</dt><dd data-testid="wm8-cand-photos" className="tabular">{s.candidates.photos} <span className="text-[10px] text-ink-400">controlled rig shots · operational / identity never counted</span></dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" data-testid="wm8-run" disabled={!cur.enabled || !s.isManager} onClick={() => void (async () => { try { setErr(null); const r = await wm8.runWm8Export(); setS(r.seam); setMsg(`Export run · ${r.added} object${r.added === 1 ? '' : 's'} logged (mock)`); setTimeout(() => setMsg(null), 3000); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } })()} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"><Play size={12} /> Run export now (mock)</button>
          <button type="button" data-testid="wm8-ack" disabled={!s.log.some((r) => !r.acked) || !s.isManager} onClick={() => void run(wm8.ackWm8Export, 'Ack received (mock)')} className="inline-flex items-center gap-1 rounded-sm border border-line px-2.5 py-1 text-xs hover:bg-canvas disabled:opacity-40"><ShieldCheck size={12} /> Simulate WatchM8 ack</button>
          {import.meta.env.DEV && s.log.length > 0 && <button type="button" data-testid="wm8-clear-log" onClick={() => void run(wm8.clearWm8Log, 'Log cleared (dev)')} className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-ink-400 hover:text-ink"><Trash2 size={11} /> Dev · clear log</button>}
        </div>
        <p className="mt-2 text-[10px] text-ink-400">Read-only preview of every record: <Link to="/setup/inspection" className="text-brand hover:underline">Setup → Inspection → Data out</Link>.</p>
      </Card>
    </div>

    <Card title="Export log" subtitle={<span className="inline-flex items-center gap-1"><Database size={12} /> Append-only · seq · type · object · hash · licence version · agreement ref · exported at · acked</span>} testId="wm8-log" bodyClassName="p-0" action={<span data-testid="wm8-log-count" className="text-[11px] text-ink-500">{s.log.length} row{s.log.length === 1 ? '' : 's'}</span>}>
      {s.log.length === 0 ? <p data-testid="wm8-log-empty" className="px-3 py-3 text-xs text-ink-400">Empty — the switch is off, nothing has left.</p>
        : <Table><thead><tr><Th>Seq</Th><Th>Type</Th><Th>Object</Th><Th>Hash</Th><Th>Licence</Th><Th>Agreement</Th><Th>Exported at</Th><Th>Env</Th><Th>Acked</Th></tr></thead>
          <tbody>{s.log.map((r) => <tr key={r.seq} data-testid={`wm8-log-row-${r.seq}`} data-type={r.type} data-acked={r.acked}><Td className="font-mono text-xs tabular">{r.seq}</Td><Td className="text-xs uppercase text-ink-500">{r.type}</Td><Td className="text-xs">{r.object}</Td><Td className="font-mono text-[11px]">{r.hash}</Td><Td className="font-mono text-[11px]">{r.licenceVersion}</Td><Td className="font-mono text-[11px]">{r.agreementRef}</Td><Td className="text-xs text-ink-500">{fmtDate(r.exportedAt)} {fmtTime(r.exportedAt)} · {r.by}</Td><Td className="text-[10px] uppercase text-ink-500">{r.env}</Td><Td className="text-xs">{r.acked ? <span className="text-moss-700">✓ {r.ackedAt ? fmtTime(r.ackedAt) : ''}</span> : <span className="text-amber-700">pending</span>}</Td></tr>)}</tbody></Table>}
    </Card>
  </div>;
}
