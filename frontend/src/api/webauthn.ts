// Touch ID / WebAuthn platform-authenticator sign-in for the pads — PROTOTYPE: local random challenge, credential id stored per device, NO signature verification (Keeper: server-issued challenge + verification + session).
// Pitfalls honoured: secure context only, RP id = current host, calls only from a user gesture, allowCredentials with transports internal, standalone PWA storage is separate from Safari.
const KEY = 'rollisuite.rw.webauthn'; // { [userId]: credentialIdBase64Url }
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const unb64 = (v: string) => Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(v.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const read = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>; } catch { return {}; } };
export const enrolledCredential = (userId: string): string | undefined => read()[userId];
export const isStandalonePwa = () => window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
export const webauthnSupported = () => typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && window.isSecureContext;
export async function platformAuthenticatorAvailable(): Promise<boolean> { if (!webauthnSupported() || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false; try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } }
export async function enrolTouchId(user: { id: string; firstName: string; displayName: string }): Promise<string> {
  const existing = enrolledCredential(user.id);
  const cred = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { id: window.location.hostname, name: 'RolliWorking' }, user: { id: new TextEncoder().encode(user.id), name: user.firstName, displayName: user.displayName }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' }, excludeCredentials: existing ? [{ type: 'public-key', id: unb64(existing), transports: ['internal'] }] : [], attestation: 'none' } });
  if (!(cred instanceof PublicKeyCredential)) throw new Error('No platform credential was created');
  const id = b64(cred.rawId); localStorage.setItem(KEY, JSON.stringify({ ...read(), [user.id]: id })); return id;
}
export async function assertTouchId(userId: string): Promise<boolean> {
  const saved = enrolledCredential(userId); if (!saved) throw new Error('Touch ID not set up on this pad for this card');
  const cred = await navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: window.location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(saved), transports: ['internal'] }], userVerification: 'required' } });
  return cred instanceof PublicKeyCredential && b64(cred.rawId) === saved; // demo check only — not signature verification
}
export const clearTouchId = (userId: string) => { const all = read(); delete all[userId]; localStorage.setItem(KEY, JSON.stringify(all)); };
