/**
 * Global quick-add hit-list overlay (MH ruling 2026-09-24).
 * Triggered by the + button in the TopBar or Alt+T from anywhere.
 * Supports @name / @role autocomplete (same-division, per division ruling).
 * Auto-attaches job / client / estimate context from the current URL.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Pin, X } from 'lucide-react';
import * as api from '@/api/client';
import type { Division, Role } from '@/api/client';
import type { Assignee } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

// ─── Context ─────────────────────────────────────────────────────────────────

interface QuickAddCtx { open: () => void }
const Ctx = createContext<QuickAddCtx | null>(null);
export const useQuickAdd = (): QuickAddCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useQuickAdd must be inside QuickAddProvider');
  return c;
};

// ─── Toast ───────────────────────────────────────────────────────────────────

let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const toastSubs: Set<(msg: string | null) => void> = new Set();
export const showToast = (msg: string) => {
  toastSubs.forEach((fn) => fn(msg));
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastSubs.forEach((fn) => fn(null)), 2800);
};

const Toast = () => {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { toastSubs.add(setMsg); return () => { toastSubs.delete(setMsg); }; }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-rise rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
      <Pin size={13} className="mr-2 inline-block text-amber-400" />{msg}
    </div>
  );
};

// ─── Context extraction from URL ─────────────────────────────────────────────

interface PageContext { jobId?: string; clientId?: string; estimateId?: string; label?: string }

const usePageContext = (): PageContext => {
  const { pathname } = useLocation();
  const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
  const clientMatch = pathname.match(/^\/clients\/([^/]+)$/);
  const estMatch = pathname.match(/^\/estimates\/([^/]+)$/);
  if (jobMatch) return { jobId: jobMatch[1], label: `job ${jobMatch[1]}` };
  if (clientMatch) return { clientId: clientMatch[1], label: `client` };
  if (estMatch) return { estimateId: estMatch[1], label: `estimate ${estMatch[1]}` };
  return {};
};

// ─── @mention autocomplete helpers ───────────────────────────────────────────

const getMentionQuery = (value: string): string | null => {
  const m = value.match(/[#@](\w*)$/);
  return m ? m[1] : null;
};

interface Suggestion { key: string; label: string; handle: string; isRole: boolean }

const buildSuggestions = (query: string, div: Division, meShortName: string): Suggestion[] => {
  const q = query.toLowerCase();
  const staff = api.getDivisionStaff(div);
  const roles = api.getDivisionRoles(div);
  const out: Suggestion[] = [];
  staff.forEach((u) => {
    if (u.shortName === meShortName) return; // skip self — unprefixed text goes to self
    const match = u.shortName.toLowerCase().startsWith(q) || u.firstName.toLowerCase().startsWith(q);
    if (match) out.push({ key: `user:${u.shortName}`, label: u.displayName, handle: u.firstName.toLowerCase(), isRole: false });
  });
  roles.forEach((r) => {
    if (r.toLowerCase().startsWith(q)) {
      const holders = api.getDivisionStaff(div).filter((u) => u.roles.includes(r as Role));
      out.push({ key: `role:${r}`, label: `${r} → ${holders.map((u) => u.shortName).join(', ')}`, handle: r, isRole: true });
    }
  });
  return out.slice(0, 6);
};



// ─── Overlay component ───────────────────────────────────────────────────────

const Overlay = ({ onClose }: { onClose: () => void }) => {
  const { user, station } = useAuth();
  const pageCtx = usePageContext();
  const sessionDiv: Division = station?.division ?? 'rolliworks';
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Update suggestions whenever input changes
  useEffect(() => {
    const q = getMentionQuery(value);
    if (q !== null) {
      setSuggestions(buildSuggestions(q, sessionDiv, user?.shortName ?? ''));
      setActiveIdx(0);
    } else {
      setSuggestions([]);
    }
  }, [value, sessionDiv, user?.shortName]);

  const insertSuggestion = useCallback((s: Suggestion) => {
    const newVal = value.replace(/[#@]\w*$/, `@${s.handle} `);
    setValue(newVal);
    setSuggestions([]);
    inputRef.current?.focus();
  }, [value]);

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Resolve assignee: if @mention in text, parsePin handles it; otherwise pin to self
      const hasMention = /^[#@]\w+\s/.test(text);
      const selfAssignee: Assignee = { type: 'user', shortName: user!.shortName };
      const parsed = api.parsePin(text, selfAssignee);
      // Confirm assignee name for toast
      const targetName = parsed.assignedTo.type === 'user'
        ? parsed.assignedTo.shortName
        : `${parsed.assignedTo.role} role`;
      await api.pinToHitList({
        title: text,
        assignedTo: hasMention ? undefined : selfAssignee, // let parsePin win when mention present
        jobId: pageCtx.jobId,
        clientId: pageCtx.clientId,
        estimateId: pageCtx.estimateId,
      });
      const toWhom = hasMention ? `${targetName}'s list` : 'your list';
      showToast(`Pinned to ${toWhom}${pageCtx.label ? ` · linked to ${pageCtx.label}` : ''}`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }, [value, busy, user, pageCtx, onClose]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0 && getMentionQuery(value) !== null)) {
        e.preventDefault();
        insertSuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }
    if (e.key === 'Enter') { void submit(); }
    if (e.key === 'Escape') { onClose(); }
  };

  const divLabel = sessionDiv === 'rolliworks' ? 'Rolliworks' : 'RolliShop';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-[18vh]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[600px] animate-rise rounded-md border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <Pin size={13} className="text-amber-600" />
          <span className="text-xs font-semibold text-ink-600">Quick-add to hit list</span>
          <span className="ml-auto rounded-sm border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-ink-400">{divLabel}</span>
          {pageCtx.label && (
            <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand">
              {pageCtx.label} attached
            </span>
          )}
          <button type="button" onClick={onClose} className="ml-1 text-ink-400 hover:text-ink"><X size={14} /></button>
        </div>

        {/* Input */}
        <div className="relative px-4 py-3">
          <input
            ref={inputRef}
            data-testid="quick-add-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            placeholder={`@name or @role then message… (Enter to pin, Esc to close)`}
            className="h-10 w-full rounded-sm border border-line bg-canvas px-3 text-[14px] text-ink placeholder-ink-400 focus:border-ink focus:bg-surface focus:outline-none disabled:opacity-50"
          />

          {/* @mention autocomplete dropdown */}
          {suggestions.length > 0 && (
            <ul className="absolute left-4 right-4 top-[calc(100%-4px)] z-10 rounded-b-md border border-t-0 border-line bg-surface shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={s.key}
                  data-testid={`qa-suggestion-${s.handle}`}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] ${i === activeIdx ? 'bg-brand-50 text-brand' : 'text-ink hover:bg-canvas'}`}
                  onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
                >
                  <span className="font-medium">{s.isRole ? `@${s.handle}` : `@${s.handle}`}</span>
                  <span className="text-ink-400">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <p className="text-[11px] text-ink-400">
            @name or @role to route · unprefixed → your list · <kbd className="rounded border border-line px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to pin
          </p>
          {err && <p className="text-[11px] font-medium text-rose-700">{err}</p>}
          <button
            type="button"
            data-testid="quick-add-submit"
            onClick={() => void submit()}
            disabled={busy || !value.trim()}
            className="inline-flex h-7 items-center gap-1 rounded-sm bg-ink px-3 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            <Pin size={12} /> {busy ? 'Pinning…' : 'Pin'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const QuickAddProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const openFn = useCallback(() => setOpen(true), []);

  // Alt+T global shortcut
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Ctx.Provider value={{ open: openFn }}>
      {children}
      {open && <Overlay onClose={() => setOpen(false)} />}
      <Toast />
    </Ctx.Provider>
  );
};
