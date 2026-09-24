import clsx from 'clsx';
import { ArrowDown, ArrowUp, GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { CatalogService, DeptCode, EstimateLine, LineType } from '@/api/client';
import { DeptBadge } from '@/components/ui/Pills';
import { Provisional } from './EstimateBits';
import { fmtMoneyCents } from '@/lib/format';

const DEPTS: DeptCode[] = ['W', 'B', 'P', 'PM'];
const TYPES: LineType[] = ['service', 'part', 'shipping'];

export const blankLine = (taxable: boolean): EstimateLine => ({ id: `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, description: '', qty: 1, unitPrice: 0, dept: 'W', taxable, type: 'service' });

const isBlank = (l: EstimateLine) => !l.description.trim() && l.unitPrice === 0;

interface Props {
  lines: EstimateLine[];
  onChange: (lines: EstimateLine[]) => void;
  readOnly?: boolean;
  blankTaxableDefault: boolean; // create: false, detail: true (per pack)
  minBlank?: number; // detail keeps ≥2 blank rows
}

const CatalogPicker = ({ onPick }: { onPick: (s: CatalogService) => void }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api.getServiceCatalog().then(setCatalog);
  }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.filter((c) => !s || c.name.toLowerCase().includes(s) || c.dept.toLowerCase() === s).slice(0, 10);
  }, [catalog, q]);
  const pick = (s: CatalogService) => {
    onPick(s);
    setQ('');
    setOpen(false);
  };
  return (
    <div ref={wrap} className="relative">
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        data-testid="catalog-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); pick(hits[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Add from service catalog — type to search, Enter to add"
        className="h-9 w-full rounded-sm border border-line bg-canvas pl-8 pr-2 text-[13px] focus:border-ink focus:bg-surface focus:outline-none"
      />
      {open && hits.length > 0 && (
        <ul data-testid="catalog-results" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md bg-surface p-1 shadow-pop animate-rise">
          {hits.map((s, i) => (
            <li key={s.id}>
              <button type="button" data-testid={`catalog-${s.id}`} onMouseEnter={() => setActive(i)} onClick={() => pick(s)} className={clsx('flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px]', i === active ? 'bg-brand-50' : 'hover:bg-canvas')}>
                <DeptBadge code={s.dept} /> <span className="flex-1 truncate text-ink">{s.name}</span>
                <span className="text-[10px] uppercase text-ink-400">{s.type}</span>
                <span className="tabular text-ink-700">{fmtMoneyCents(s.rate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const LineEditor = ({ lines, onChange, readOnly, blankTaxableDefault, minBlank = 0 }: Props) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const padded = useMemo(() => {
    if (readOnly) return lines;
    const blanks = lines.filter(isBlank).length;
    const need = Math.max(0, minBlank - blanks);
    return need ? [...lines, ...Array.from({ length: need }, () => blankLine(blankTaxableDefault))] : lines;
  }, [lines, readOnly, minBlank, blankTaxableDefault]);

  useEffect(() => {
    if (padded !== lines && padded.length !== lines.length) onChange(padded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padded.length]);

  const set = (i: number, patch: Partial<EstimateLine>) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= lines.length || from === to) return;
    const next = [...lines];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };
  const addCatalog = (s: CatalogService) => {
    const row: EstimateLine = { ...blankLine(blankTaxableDefault), description: s.name, unitPrice: s.rate, dept: s.dept, type: s.type, catalogId: s.id, taxable: s.type === 'shipping' ? false : blankTaxableDefault };
    const firstBlank = lines.findIndex(isBlank);
    onChange(firstBlank >= 0 ? lines.map((l, i) => (i === firstBlank ? row : l)) : [...lines, row]);
  };
  const setAmount = (i: number, amount: number) => {
    const l = lines[i];
    if (!l.qty) return;
    set(i, { unitPrice: Math.round((amount / l.qty) * 100) / 100 });
  };

  const totals = api.computeEstimateTotals(lines);

  return (
    <div data-testid="line-editor">
      {!readOnly && (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1"><CatalogPicker onPick={addCatalog} /></div>
          <button type="button" data-testid="line-add-custom" onClick={() => onChange([...lines, blankLine(blankTaxableDefault)])} className="inline-flex h-9 items-center gap-1 rounded-sm border border-line bg-surface px-3 text-xs font-medium text-ink-700 hover:border-ink-300">
            <Plus size={13} /> Custom line
          </button>
        </div>
      )}
      <table className="w-full text-[13px]" data-testid="line-table">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
            {!readOnly && <th className="w-6" />}
            <th className="py-1.5 pr-2">Description</th>
            <th className="w-16 py-1.5 pr-2">Dept</th>
            <th className="w-24 py-1.5 pr-2">Type</th>
            <th className="w-16 py-1.5 pr-2 text-right">Qty</th>
            <th className="w-28 py-1.5 pr-2 text-right">Rate</th>
            <th className="w-28 py-1.5 pr-2 text-right">Amount</th>
            <th className="w-12 py-1.5 text-center" title="Taxable (tax is never applied — provisional)">Tax</th>
            {!readOnly && <th className="w-20" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr
              key={l.id}
              data-testid={`line-row-${i}`}
              draggable={!readOnly}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
              className={clsx('border-t border-line/70 align-middle', dragIdx === i && 'opacity-40', isBlank(l) && 'text-ink-400')}
            >
              {!readOnly && <td className="cursor-grab text-ink-300"><GripVertical size={13} /></td>}
              <td className="py-1 pr-2">
                {readOnly ? <span className="text-ink">{l.description}</span> : (
                  <input data-testid={`line-desc-${i}`} value={l.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Description" className="h-8 w-full rounded-sm border border-transparent bg-transparent px-2 hover:border-line focus:border-ink focus:bg-surface focus:outline-none" />
                )}
              </td>
              <td className="py-1 pr-2">
                {readOnly ? <DeptBadge code={l.dept} /> : (
                  <select data-testid={`line-dept-${i}`} value={l.dept} onChange={(e) => set(i, { dept: e.target.value as DeptCode })} className="h-8 w-full rounded-sm border border-line bg-canvas px-1 font-mono text-xs">
                    {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </td>
              <td className="py-1 pr-2">
                {readOnly ? <span className="text-xs text-ink-500">{l.type}</span> : (
                  <select data-testid={`line-type-${i}`} value={l.type} onChange={(e) => set(i, { type: e.target.value as LineType })} className="h-8 w-full rounded-sm border border-line bg-canvas px-1 text-xs">
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </td>
              <td className="py-1 pr-2 text-right">
                {readOnly ? <span className="tabular">{l.qty}</span> : (
                  <input data-testid={`line-qty-${i}`} type="number" min={0} step={1} value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} className="tabular h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-right hover:border-line focus:border-ink focus:bg-surface focus:outline-none" />
                )}
              </td>
              <td className="py-1 pr-2 text-right">
                {readOnly ? <span className="tabular">{fmtMoneyCents(l.unitPrice)}</span> : (
                  <input data-testid={`line-rate-${i}`} type="number" min={0} step={0.01} value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} className="tabular h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-right hover:border-line focus:border-ink focus:bg-surface focus:outline-none" />
                )}
              </td>
              <td className="py-1 pr-2 text-right">
                {readOnly ? <span className="tabular font-medium">{fmtMoneyCents(l.qty * l.unitPrice)}</span> : (
                  <input data-testid={`line-amount-${i}`} type="number" min={0} step={0.01} value={Math.round(l.qty * l.unitPrice * 100) / 100} onChange={(e) => setAmount(i, Number(e.target.value))} title="Editing amount back-calculates the rate" className="tabular h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-right font-medium hover:border-line focus:border-ink focus:bg-surface focus:outline-none" />
                )}
              </td>
              <td className="py-1 text-center"><input type="checkbox" data-testid={`line-taxable-${i}`} checked={l.taxable} disabled={readOnly} onChange={(e) => set(i, { taxable: e.target.checked })} className="accent-ink" /></td>
              {!readOnly && (
                <td className="py-1 text-right">
                  <span className="inline-flex items-center gap-0.5 text-ink-400">
                    <button type="button" aria-label="Move up" data-testid={`line-up-${i}`} onClick={() => move(i, i - 1)} className="rounded-sm p-1 hover:bg-canvas hover:text-ink"><ArrowUp size={12} /></button>
                    <button type="button" aria-label="Move down" data-testid={`line-down-${i}`} onClick={() => move(i, i + 1)} className="rounded-sm p-1 hover:bg-canvas hover:text-ink"><ArrowDown size={12} /></button>
                    <button type="button" aria-label="Remove line" data-testid={`line-remove-${i}`} onClick={() => remove(i)} className="rounded-sm p-1 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={12} /></button>
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-[300px] space-y-1 text-[13px]" data-testid="totals">
        <div className="flex justify-between text-ink-700"><span>Subtotal</span><span className="tabular" data-testid="total-subtotal">{fmtMoneyCents(totals.subtotal)}</span></div>
        <div className="flex justify-between text-ink-500"><span>of which shipping lines</span><span className="tabular" data-testid="total-shipping">{fmtMoneyCents(totals.shippingAmount)}</span></div>
        <div className="flex items-center justify-between text-ink-500">
          <span className="inline-flex items-center gap-1.5">Tax <Provisional note="8.25% exists in legacy and is not applied — kept at 0" /> <span className="text-[11px] text-ink-400">8.25% not applied</span></span>
          <span className="tabular" data-testid="total-tax">{fmtMoneyCents(0)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-1 text-[15px] font-semibold text-ink"><span>Total</span><span className="tabular" data-testid="total-total">{fmtMoneyCents(totals.total)}</span></div>
      </div>
    </div>
  );
};
