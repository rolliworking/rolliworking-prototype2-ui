import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { SearchHit, SearchResults } from '@/api/client';
import { flattenHits, SearchHitList } from './SearchHitList';

interface Props {
  autoFocus?: boolean;
  inline?: boolean;
  placeholder?: string;
  testIdPrefix?: string;
  className?: string;
}

// One box that accepts any identifier. Enter picks the highlighted hit; ↑/↓ move across groups.
export const IdentifierSearch = ({ autoFocus, inline, placeholder, testIdPrefix = 'identifier-search', className }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const hits = flattenHits(results);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.resolveIdentifier(query).then((r) => {
        setResults(r);
        setActive(0);
        setOpen(true);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (inline) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [inline]);

  const pick = (h: SearchHit) => {
    setOpen(false);
    setQuery('');
    navigate(h.path);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(hits[active]);
    }
  };

  const showEmpty = query.trim().length > 0 && results !== null && results.total === 0;
  const showList = (inline || open) && (hits.length > 0 || showEmpty);

  const list = showEmpty ? (
    <div className="px-3 py-3 text-xs text-ink-400" data-testid={`${testIdPrefix}-empty`}>
      Nothing matches “{query}”. Try a name, email, phone, estimate #, SUB#, tracking number, watch ref or serial.
    </div>
  ) : results ? (
    <SearchHitList results={results} active={active} onHover={setActive} onPick={pick} dense={inline} />
  ) : null;

  return (
    <div ref={wrapRef} className={className ?? 'relative w-full'}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-4 -translate-y-1/2 text-ink-400" />
      <input
        data-testid={`${testIdPrefix}-input`}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder ?? 'Search anything — name, email, phone, est #, SUB#, tracking, ref, serial, SO #…'}
        className="h-8 w-full rounded-sm border border-line bg-canvas pl-8 pr-7 text-[13px] text-ink placeholder:text-ink-400 transition-[border-color,background-color] duration-150 focus:border-brand focus:bg-surface focus:outline-none"
        autoComplete="off"
      />
      {query && (
        <button type="button" data-testid={`${testIdPrefix}-clear`} onClick={() => setQuery('')} className="absolute right-1.5 top-4 -translate-y-1/2 rounded-sm p-0.5 text-ink-400 hover:text-ink" aria-label="Clear">
          <X size={12} />
        </button>
      )}
      {showList && (
        inline ? (
          <div data-testid={`${testIdPrefix}-results`} className="mt-2 overflow-hidden rounded-md bg-surface shadow-card animate-rise">{list}</div>
        ) : (
          <div data-testid={`${testIdPrefix}-results`} className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md bg-surface shadow-pop animate-rise">{list}</div>
        )
      )}
    </div>
  );
};
