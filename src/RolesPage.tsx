import { useCallback, useEffect, useMemo, useState } from "react";
import { listRolePermissions, saveRolePermission, PrototypeApiError } from "./api/client";

type Row = Record<string, unknown>;

function errMsg(e: unknown) {
  if (e instanceof PrototypeApiError) {
    return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return "Request failed";
}

export function RolesPage() {
  const [roleFilter, setRoleFilter] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listRolePermissions({
        role: roleFilter || undefined,
      });
      setItems(((res as { items?: Row[] }).items || []) as Row[]);
    } catch (e) {
      setError(errMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) if (row.role) set.add(String(row.role));
    return [...set].sort();
  }, [items]);

  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) if (row.permission_key) set.add(String(row.permission_key));
    return [...set].sort();
  }, [items]);

  function enabledFor(role: string, key: string): boolean | null {
    const row = items.find(
      (r) => String(r.role) === role && String(r.permission_key) === key
    );
    if (!row) return null;
    return Boolean(row.enabled);
  }

  async function onToggle(role: string, permission_key: string, enabled: boolean) {
    if (role === "admin") {
      setError("admin permissions are locked on");
      return;
    }
    const token = `${role}:${permission_key}`;
    setBusyKey(token);
    setNotice(null);
    setError(null);
    try {
      await saveRolePermission({ role, permission_key, enabled });
      setNotice(`Saved ${role} / ${permission_key} → ${enabled ? "on" : "off"}`);
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <h1>Roles & permissions</h1>
      <p className="sub">
        Rebuild matrix from prototype-api. Admin rows stay locked. Access tier and duty stay separate
        (D-166).
      </p>

      <div className="toolbar">
        <label>
          Role filter
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">all</option>
            {["admin", "manager", "front_desk", "team", "band_room", ...roles]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
          </select>
        </label>
        <button type="button" onClick={() => void reload()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="banner">{notice}</div> : null}

      <div className="panel table-wrap">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="empty">No permission rows</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map((r) => (
                  <th key={r}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  {roles.map((role) => {
                    const on = enabledFor(role, key);
                    const locked = role === "admin";
                    const token = `${role}:${key}`;
                    return (
                      <td key={token}>
                        {on == null ? (
                          "—"
                        ) : (
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked || busyKey === token}
                            onChange={(e) => void onToggle(role, key, e.target.checked)}
                            title={locked ? "admin locked" : `${role} ${key}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
