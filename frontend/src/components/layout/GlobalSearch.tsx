import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { Client } from '@/api/client';
import { fullName } from '@/lib/format';

export const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchClients(query).then((rows) => {
        setResults(rows);
        setActive(0);
        setOpen(true);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const select = (c: Client) => {
    setOpen(false);
    setQuery('');
    navigate(`/clients/${c.id}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setOpen(false);
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[active]);
    }
  };

  const showEmpty = open && query.trim() && results.length === 0;

  return (
    <div ref={wrapRef} className="relative w-[360px] shrink-0">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        data-testid="global-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search name, est #, SO #, part #, email, phone…"
        className="h-8 w-full rounded-sm border border-line bg-canvas pl-8 pr-2 text-[13px] text-ink placeholder:text-ink-400 transition-[border-color,background-color] duration-150 focus:border-brand focus:bg-surface focus:outline-none"
        autoComplete="off"
      />

      {open && (results.length > 0 || showEmpty) && (
        <div
          data-testid="global-search-results"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md bg-surface shadow-pop animate-rise"
        >
          {showEmpty ? (
            <div className="px-3 py-3 text-xs text-ink-400" data-testid="global-search-empty">
              No clients match “{query}”.
            </div>
          ) : (
            <ul role="listbox">
              {results.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    data-testid={`search-result-${c.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => select(c)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                      i === active ? 'bg-brand-50' : 'hover:bg-canvas'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink">
                        {fullName(c)}
                        {c.company && <span className="ml-1.5 text-xs font-normal text-ink-400">{c.company}</span>}
                      </div>
                      <div className="truncate text-xs text-ink-500">{c.email}</div>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-ink-500">{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
