import { FormEvent, useState } from "react";
import { signInWithPassword, switchUserWithPin, PrototypeApiError } from "./api/client";
import {
  clearSession,
  getOrCreateDeviceId,
  saveSession,
  SessionUser,
} from "./session";

type Props = {
  onSignedIn: (user: SessionUser) => void;
};

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Sign-in failed";
}

/**
 * Try getUserMedia once; on success return a placeholder snapshot_ref.
 * Prototypes do not upload the image — audit gets a ref or null (camera_fallback).
 */
async function captureSnapshotRef(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    return `webcam:${Date.now()}`;
  } catch {
    return null;
  }
}

export function AuthGate({ onSignedIn }: Props) {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [username, setUsername] = useState("michael");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const deviceId = getOrCreateDeviceId();

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFallbackNote(null);
    try {
      const snapshot_ref = await captureSnapshotRef();
      if (!snapshot_ref) {
        setFallbackNote("No camera / denied — sign-in continues; audit records camera fallback.");
      }
      const res = (await signInWithPassword({
        username: username.trim(),
        password,
        device_id: deviceId,
        snapshot_ref,
      })) as {
        session_token?: string;
        user?: SessionUser;
        audit_event?: { camera_fallback?: boolean };
      };
      if (!res.session_token || !res.user) {
        throw new Error("Sign-in response missing session_token/user");
      }
      saveSession(res.session_token, res.user);
      if (res.audit_event?.camera_fallback) {
        setFallbackNote("Signed in with camera_fallback on the audit event.");
      }
      onSignedIn(res.user);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!/^\d{4}$/.test(pin)) {
        throw new Error("PIN must be exactly 4 digits");
      }
      const res = (await switchUserWithPin({
        pin,
        device_id: deviceId,
      })) as { user?: SessionUser };
      if (!res.user) throw new Error("PIN switch response missing user");
      // Keep prior token if any; PIN switch returns user + audit only
      const existing = localStorage.getItem("prototype.session_token");
      if (existing) saveSession(existing, res.user);
      else saveSession("pin-switch", res.user);
      onSignedIn(res.user);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand">Rolliworks Prototype</div>
        <p className="sub">
          D-181: password sign-in · webcam snapshot when allowed · 4-digit PIN same-day switch ·
          device-bound station (no station picker). Badge codes rejected by the API.
        </p>
        <p className="sub">Device id: <code>{deviceId.slice(0, 12)}…</code></p>

        <div className="actions">
          <button
            type="button"
            onClick={() => setMode("password")}
            style={mode === "password" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("pin")}
            style={mode === "pin" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          >
            PIN switch
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {fallbackNote ? <div className="banner">{fallbackNote}</div> : null}

        {mode === "password" ? (
          <form onSubmit={onPassword} className="auth-form">
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={onPin} className="auth-form">
            <label>
              4-digit PIN
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                pattern="\d{4}"
                required
              />
            </label>
            <button type="submit" disabled={busy || pin.length !== 4}>
              Switch user
            </button>
          </form>
        )}

        <button
          type="button"
          className="linkish"
          style={{ marginTop: "1rem" }}
          onClick={() => {
            clearSession();
            setError(null);
            setFallbackNote("Local session cleared.");
          }}
        >
          Clear local session
        </button>
      </div>
    </div>
  );
}
