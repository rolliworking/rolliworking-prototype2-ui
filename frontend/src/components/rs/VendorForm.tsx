import { useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { Vendor, VendorInput } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const TERMS = ['Net 30', 'Net 15', 'Net 45', 'Net 60', 'Due on receipt', 'Prepaid', 'Credit card on file'];
const METHODS = ['Email PO (PDF)', 'Vendor portal', 'Phone', 'Fax', 'EDI'];
const L = ({ k, label, children }: { k: string; label: string; children: ReactNode }) => <label className="block text-xs text-ink-500" data-testid={`vendor-field-${k}`}>{label}{children}</label>;
const blank = (): VendorInput => ({ name: '', contact: '', email: '', phone: '', terms: 'Net 30', division: api.getSessionDivision(), active: true, accountRef: '', minOrder: '', preferredMethod: 'Email PO (PDF)', leadTimeDays: undefined, shippingNotes: '', notes: '' });

// One form for add + edit — the record it writes is the same one CSV import / PO auto-catalog create (no second vendor "type")
export const VendorForm = ({ vendor, onClose, onSaved }: { vendor?: Vendor; onClose: () => void; onSaved: (v: Vendor) => void }) => {
  const [f, setF] = useState<VendorInput>(vendor ? { ...vendor } : blank());
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<VendorInput>) => setF({ ...f, ...patch });
  const save = async () => { try { setError(null); onSaved(await api.saveVendor(f)); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  return <Modal testId="vendor-modal" title={vendor ? `Edit vendor · ${vendor.name}` : 'New vendor'} width="w-[640px]" onClose={onClose}>
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <L k="name" label="Vendor name *"><input data-testid="vendor-name" value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
        <L k="division" label="Division"><select data-testid="vendor-division" value={f.division} onChange={(e) => set({ division: e.target.value as VendorInput['division'] })} className={`${field} mt-1 block w-full`}><option value="rolliworks">rolliworks</option><option value="rollishop">rollishop</option></select></L>
      </div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Contact</div><div className="mt-1 grid grid-cols-3 gap-2">
        <L k="contact" label="Person"><input data-testid="vendor-contact" value={f.contact} onChange={(e) => set({ contact: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
        <L k="email" label="Email"><input data-testid="vendor-email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
        <L k="phone" label="Phone"><input data-testid="vendor-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
      </div></div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Terms & account</div><div className="mt-1 grid grid-cols-2 gap-2">
        <L k="terms" label="Payment terms"><input list="vendor-terms-list" data-testid="vendor-terms" value={f.terms} onChange={(e) => set({ terms: e.target.value })} className={`${field} mt-1 block w-full`} /><datalist id="vendor-terms-list">{TERMS.map((t) => <option key={t} value={t} />)}</datalist></L>
        <L k="accountRef" label="Our account / reference # with them"><input data-testid="vendor-account-ref" value={f.accountRef ?? ''} onChange={(e) => set({ accountRef: e.target.value })} placeholder="e.g. RG-4471" className={`${field} mt-1 block w-full`} /></L>
      </div></div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Shipping / ordering</div><div className="mt-1 grid grid-cols-3 gap-2">
        <L k="minOrder" label="Minimum order"><input data-testid="vendor-min-order" value={f.minOrder ?? ''} onChange={(e) => set({ minOrder: e.target.value })} placeholder="e.g. $250" className={`${field} mt-1 block w-full`} /></L>
        <L k="preferredMethod" label="Preferred ordering method"><input list="vendor-method-list" data-testid="vendor-method" value={f.preferredMethod ?? ''} onChange={(e) => set({ preferredMethod: e.target.value })} className={`${field} mt-1 block w-full`} /><datalist id="vendor-method-list">{METHODS.map((t) => <option key={t} value={t} />)}</datalist></L>
        <L k="leadTimeDays" label="Lead time (days)"><input data-testid="vendor-lead-time" type="number" min={0} value={f.leadTimeDays ?? ''} onChange={(e) => set({ leadTimeDays: e.target.value === '' ? undefined : Number(e.target.value) })} className={`${field} mt-1 block w-full`} /></L>
      </div>
        <L k="shippingNotes" label="Shipping / ordering notes"><textarea data-testid="vendor-shipping-notes" rows={2} value={f.shippingNotes ?? ''} onChange={(e) => set({ shippingNotes: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
      </div>
      <L k="notes" label="Internal notes"><textarea data-testid="vendor-notes" rows={2} value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className={`${field} mt-1 block w-full`} /></L>
      <label className="flex items-center gap-2 text-xs text-ink-700"><input type="checkbox" data-testid="vendor-active" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Active — inactive vendors drop out of Generate PO / New PO pickers but stay in purchase history</label>
      {error && <div data-testid="vendor-form-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="vendor-save" onClick={() => void save()}>{vendor ? 'Save changes' : 'Create vendor'}</Button></div>
    </div>
  </Modal>;
};
