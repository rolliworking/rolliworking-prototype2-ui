const DEVICE_KEY = "prototype.device_id";
const SESSION_KEY = "prototype.session_token";
const USER_KEY = "prototype.user";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type SessionUser = {
  id?: string;
  username?: string;
  display_name?: string;
  [key: string]: unknown;
};

export function loadSession(): { token: string | null; user: SessionUser | null } {
  const token = localStorage.getItem(SESSION_KEY);
  const raw = localStorage.getItem(USER_KEY);
  let user: SessionUser | null = null;
  if (raw) {
    try {
      user = JSON.parse(raw) as SessionUser;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}
