import { Camera, Fingerprint, MonitorSmartphone, RadioTower, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import * as off from '@/api/offline';
import * as wa from '@/api/webauthn';
import { useAuth } from '@/auth/AuthContext';
import { Big } from '@/components/rw/pad/PadBits';

type Check = { ok: boolean | null; text: string };
const Row = ({ icon: Icon, label, c, testId, children }: { icon: typeof Camera; label: string; c: Check; testId: string; children?: React.ReactNode }) => <li data-testid={testId} data-ok={c.ok} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-[#1f2630] px-4 py-2">
  <Icon size={20} className={c.ok === null ? 'text-slate-400' : c.ok ? 'text-emerald-300' : 'text-amber-300'} /><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{label}</div><div className="text-xs text-slate-400">{c.text}</div></div>{children}
</li>;

// Device check — iPad-first pass (G8): standalone install, camera (rear default), Touch ID, Web Push note, offline queue, Guided Access owner path. Every target ≥ 44 pt.
export default function RwDevicePage() {
  const { user } = useAuth(); const { online, queued } = off.useOnline();
  const [cam, setCam] = useState<Check>({ ok: null, text: 'Tap "Test camera" — asks for the rear camera (facingMode environment).' });
  const [touch, setTouch] = useState<Check>({ ok: null, text: 'checking…' }); const [msg, setMsg] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null);
  const standalone = wa.isStandalonePwa();
  useEffect(() => { void wa.platformAuthenticatorAvailable().then((ok) => setTouch({ ok, text: ok ? `Platform authenticator available${user && wa.enrolledCredential(user.id) ? ` · ${user.shortName} enrolled on this pad` : ' · not enrolled for this card yet'}` : wa.webauthnSupported() ? 'WebAuthn present but no user-verifying platform authenticator (no Touch ID / passcode?)' : 'WebAuthn unavailable — needs HTTPS (secure context) and a modern WebKit' })); return () => stream.current?.getTracks().forEach((t) => t.stop()); }, [user]);
  const testCamera = async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); stream.current = s; if (video.current) video.current.srcObject = s; const track = s.getVideoTracks()[0]; const facing = track.getSettings().facingMode; setCam({ ok: true, text: `Camera OK · ${track.label || 'camera'} · facing ${facing ?? 'unknown'}${standalone ? ' · inside the installed PWA' : ' · in the browser tab (re-test after Add to Home Screen)'}` }); } catch (e) { setCam({ ok: false, text: `${e instanceof Error ? e.name : 'Error'}: ${e instanceof Error ? e.message : 'camera blocked'}${standalone ? ' — FLAG: iPadOS blocked getUserMedia in standalone mode' : ''}` }); } };
  const enrol = async () => { if (!user) return; try { await wa.enrolTouchId(user); setTouch({ ok: true, text: `${user.shortName} enrolled on this pad · sign-in card now offers Touch ID` }); } catch (e) { setMsg(e instanceof Error ? `${e.name}: ${e.message}` : 'Enrolment failed'); } };
  const replay = async () => { const r = await off.replayQueue(async (s) => { if (s.kind === 'station' && s.station) await api.stationScan(s.station as api.RwStationKey, s.code); }); setMsg(`Replayed ${r.done} scan${r.done === 1 ? '' : 's'}${r.failed.length ? ` · ${r.failed.length} still queued (failed)` : ''}`); };
  return <div data-testid="rw-device-page" className="mx-auto max-w-3xl space-y-4 pb-24">
    <header><h1 className="text-2xl font-semibold text-white">Device check</h1><p className="text-sm text-slate-400">iPad-first pass — what this pad can do, and what still needs the app installed to the Home Screen.</p></header>
    {msg && <div data-testid="device-msg" className="rounded-2xl bg-accent/15 px-4 py-2 text-sm text-accent-100">{msg}</div>}
    <ul className="space-y-2">
      <Row icon={MonitorSmartphone} label="Installed PWA (standalone)" c={{ ok: standalone, text: standalone ? 'Running from the Home Screen icon — own storage, no Safari chrome.' : 'Browser tab. Share → Add to Home Screen, then launch the icon. Manifest: /rw-manifest.webmanifest (start /rw, landscape).' }} testId="device-standalone" />
      <Row icon={Camera} label="Camera (rear default)" c={cam} testId="device-camera"><Big testId="device-camera-test" tone="primary" onClick={() => void testCamera()}>Test camera</Big></Row>
      <video ref={video} autoPlay playsInline muted className={`w-full rounded-2xl bg-black ${cam.ok ? 'block' : 'hidden'}`} data-testid="device-camera-preview" />
      <Row icon={Fingerprint} label="Touch ID sign-in (WebAuthn)" c={touch} testId="device-touchid">{touch.ok && user && <Big testId="device-touchid-enrol" tone="quiet" onClick={() => void enrol()}>{wa.enrolledCredential(user.id) ? 'Re-enrol' : `Enrol ${user.shortName}`}</Big>}</Row>
      <Row icon={RadioTower} label="Badges / push" c={{ ok: 'PushManager' in window && standalone, text: 'PushManager' in window ? (standalone ? 'Web Push available in this installed app.' : 'iPadOS Web Push only works once the PWA is installed to the Home Screen — badge + push fall back to the in-app unread dot until then.') : 'No Web Push in this browser — unread dot in the tab bar is the fallback.' }} testId="device-push" />
      <Row icon={online ? Wifi : WifiOff} label="Connection · offline queue" c={{ ok: online, text: online ? `Online · ${queued} queued scan${queued === 1 ? '' : 's'} to replay` : `OFFLINE · board is read-only · ${queued} scan${queued === 1 ? '' : 's'} queued — custody changes only on a confirmed scan` }} testId="device-online">
        <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-300"><input type="checkbox" data-testid="device-simulate-offline" className="h-5 w-5" checked={off.simulatedOffline()} onChange={(e) => off.setSimulatedOffline(e.target.checked)} /> simulate offline</label>
        {online && queued > 0 && <Big testId="device-replay" tone="primary" onClick={() => void replay()}>Replay {queued}</Big>}
      </Row>
    </ul>
    <section data-testid="device-guided-access" className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
      <h2 className="font-semibold">Guided Access · owner path</h2>
      <p className="mt-1 text-xs">Bench pads run under iPadOS Guided Access (single app, no Home). The owner reaches <span className="font-mono">/choose-view</span> without leaving it: <b>long-press the RolliWorking brand (1.2 s) → MH PIN</b>, or the bench gear → Owner path. NOT-KEEPER: the long-press is a prototype heuristic; the kiosk lock itself stays software-only until Keeper registers device identity.</p>
      <Link to="/choose-view" data-testid="device-choose-view" className="mt-2 inline-flex min-h-[44px] items-center rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white">Open /choose-view (owner)</Link>
    </section>
    <p className="text-[11px] text-slate-500">All targets on this page are ≥ 44 pt · numeric fields use the number keypad (inputmode) · safe-area insets applied to header and tab bar.</p>
  </div>;
}
