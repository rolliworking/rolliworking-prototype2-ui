import type { Address, Payment, SOLine, SalesOrder } from '../types';
import { seedPhoto } from './intake';
import { daysAgo } from './time';

let seq = 0;
const line = (description: string, rate: number, qty = 1, dept?: SOLine['dept'], fulfilled: Partial<Pick<SOLine, 'pickedUpQty' | 'shippedQty'>> = {}): SOLine => ({ id: `sol-${String(++seq).padStart(3, '0')}`, description, qty, rate, dept, pickedUpQty: 0, shippedQty: 0, ...fulfilled });
const pay = (amount: number, method: Payment['method'], d: number, by = 'Vienna'): Payment => ({ id: `pay-${++seq}`, amount, method, at: daysAgo(d, 14), by, station: 'Front Desk 1' });
const addr = (name: string, street: string, city: string, state: string): Address => ({ name, street, city, state });

const total = (lines: SOLine[], ship = 0) => lines.reduce((t, l) => t + l.qty * l.rate, 0) + ship;
const so = (s: Omit<SalesOrder, 'total' | 'balanceDue' | 'isPaid' | 'qboStatus' | 'updatedAt' | 'createdBy' | 'shippingAmount'> & { shippingAmount?: number }): SalesOrder => {
  const shippingAmount = s.shippingAmount ?? 0;
  const t = total(s.lines, shippingAmount);
  const paid = s.payments.reduce((a, p) => a + p.amount, 0);
  return { ...s, shippingAmount, total: t, balanceDue: Math.max(0, t - paid), isPaid: paid >= t && t > 0, qboStatus: s.qboInvoiceId ? 'queued' : 'not_queued', updatedAt: s.createdAt, createdBy: 'Vienna' };
};

// One SO per tail stage: draft · open unpaid (awaiting payment) · fulfilled+pickup (ready for pickup) · fulfilled+ship (ready to ship) · shipped · picked_up · cancelled
export const salesOrders: SalesOrder[] = [
  so({ id: 'so-01', number: 'SO-26-0101', clientId: 'c-21', estimateId: undefined, status: 'draft', orderDate: daysAgo(1, 10), lines: [line('Oyster bracelet 78360 — replacement', 1450, 1, 'B'), line('Spring bars (pair)', 24, 2, 'B')], memo: 'Walk-in parts order — confirm reference before opening.', payments: [], createdAt: daysAgo(1, 10) }),
  so({ id: 'so-02', number: 'SO-26-0102', clientId: 'c-12', jobId: 'j-07', status: 'open', channel: 'pickup', orderDate: daysAgo(1, 15), lines: [line('Bracelet clasp replacement', 320, 1, 'B'), line('Bracelet re-pin', 160, 1, 'B')], payments: [], createdAt: daysAgo(1, 15) }),
  so({ id: 'so-03', number: 'SO-26-0103', clientId: 'c-14', jobId: 'j-21', status: 'fulfilled', channel: 'pickup', orderDate: daysAgo(3, 11), fulfilledAt: daysAgo(2, 16), lines: [line('Movement service — cal. 2235', 1150, 1, 'W'), line('Case refinish', 320, 1, 'P')], payments: [pay(1000, 'card', 2)], qboInvoiceId: 'QBO-STUB-10471', pickupCode: '4Q7M-82', pickupCodeIssuedAt: daysAgo(2, 16), createdAt: daysAgo(3, 11) }),
  so({ id: 'so-04', number: 'SO-26-0104', clientId: 'c-15', jobId: 'j-22', status: 'fulfilled', channel: 'ship', orderDate: daysAgo(4, 9), fulfilledAt: daysAgo(2, 10), shippingAmount: 85, lines: [line('Movement service — cal. 3235', 1450, 1, 'W')], payments: [pay(800, 'wire', 3, 'MH'), pay(735, 'card', 2)], qboInvoiceId: 'QBO-STUB-10472', shippingInfoRequestedAt: daysAgo(3, 9), shippingAddress: addr('Oliver Pemberton', '412 Harbor View Dr', 'Sausalito', 'CA'), createdAt: daysAgo(4, 9) }),
  so({ id: 'so-05', number: 'SO-26-0105', clientId: 'c-10', jobId: 'j-08', status: 'shipped', channel: 'ship', orderDate: daysAgo(12, 9), fulfilledAt: daysAgo(10, 10), shipDate: daysAgo(9, 15), shippingAmount: 85, lines: [line('Case & bracelet refinish — brushed/polished', 340, 1, 'P', { shippedQty: 1 })], payments: [pay(425, 'card', 10)], qboInvoiceId: 'QBO-STUB-10455', shippingAddress: addr('Naomi Castellanos', '88 Pine Crest Rd', 'Bend', 'OR'), tracking: '1Z 999 AA1 01 2345 6784', createdAt: daysAgo(12, 9),
    shipment: { id: 'shp-01', carrier: 'ups', service: 'UPS Next Day Air', tracking: '1Z 999 AA1 01 2345 6784', labelId: 'LBL-MOCK-0001', labelDataUrl: seedPhoto('UPS label SO-26-0105').dataUrl, declaredValue: 9000, coverage: 9000, photos: [seedPhoto('Packed box SO-26-0105')], address: addr('Naomi Castellanos', '88 Pine Crest Rd', 'Bend', 'OR'), at: daysAgo(9, 15), by: 'Vienna', station: 'Front Desk 1' } }),
  so({ id: 'so-06', number: 'SO-26-0106', clientId: 'c-15', jobId: 'j-09', status: 'picked_up', channel: 'pickup', orderDate: daysAgo(9, 9), fulfilledAt: daysAgo(6, 12), pickedUpAt: daysAgo(4, 11), lines: [line('Complete movement service — cal. 3235', 1450, 1, 'W', { pickedUpQty: 1 }), line('Bracelet re-pin & tighten', 260, 1, 'B', { pickedUpQty: 1 }), line('Case & bracelet refinish', 540, 1, 'P', { pickedUpQty: 1 })], payments: [pay(2250, 'card', 5)], qboInvoiceId: 'QBO-STUB-10460', pickupCode: 'K2P9-31', pickupCodeIssuedAt: daysAgo(6, 12), createdAt: daysAgo(9, 9),
    pickupSession: { id: 'pks-01', codeUsed: 'K2P9-31', photos: [seedPhoto('Hand-back SO-26-0106')], lineQty: {}, at: daysAgo(4, 11), by: 'Vienna', station: 'Front Desk 1' } }),
  so({ id: 'so-07', number: 'SO-26-0107', clientId: 'c-23', status: 'cancelled', orderDate: daysAgo(6, 9), cancelledAt: daysAgo(5, 9), lines: [line('Jubilee bracelet 63600 — replacement', 1250, 1, 'B')], memo: 'Client found the bracelet elsewhere.', payments: [], createdAt: daysAgo(6, 9) }),
  // Client 360 seed — Naomi's 2024 Tudor job, paid in two parts and picked up
  so({ id: 'so-08', number: 'SO-25-0042', clientId: 'c-10', jobId: 'j-25', status: 'picked_up', channel: 'pickup', orderDate: daysAgo(392, 9), fulfilledAt: daysAgo(391, 12), pickedUpAt: daysAgo(389, 11), lines: [line('Replace bezel insert (blue)', 290, 1, 'W', { pickedUpQty: 1 }), line('Clasp spring & re-pin', 160, 1, 'B', { pickedUpQty: 1 }), line('Ultrasonic clean', 60, 1, 'P', { pickedUpQty: 1 })], payments: [pay(250, 'card', 392), pay(260, 'cash', 389)], qboInvoiceId: 'QBO-STUB-09811', pickupCode: 'H7N2-55', pickupCodeIssuedAt: daysAgo(391, 12), createdAt: daysAgo(392, 9),
    pickupSession: { id: 'pks-02', codeUsed: 'H7N2-55', photos: [seedPhoto('Hand-back SO-25-0042')], lineQty: {}, at: daysAgo(389, 11), by: 'Vienna', station: 'Front Desk 1' } }),
];
