// Mock Parcel Pro / UPS consolidated bill — CSV the way the carrier portal exports it. Every bucket type is present:
// 2 clean matches · 1 price variance (address correction $19) · 1 VOIDED-but-billed ($34) · 1 unknown tracking # · (unbilled = ledger labels not on the bill)
export const MOCK_BILL_FILENAME = 'parcelpro-invoice-2026-09-B.csv';
export const MOCK_BILL_CSV = `Invoice,Tracking Number,Ship Date,Service,Declared Value,Base Charge,Fuel Surcharge,Address Correction,Insurance Fee,Total Billed
PP-2026-09-B,1Z7A3B9C0412345678,2026-09-24,UPS Next Day Air Saver,7900.00,78.15,9.40,0.00,5.50,93.05
PP-2026-09-B,794612385590,2026-08-24,FedEx Priority Overnight,15600.00,141.20,14.10,0.00,10.90,166.20
PP-2026-09-B,1Z7A3B9C0412345699,2026-09-20,UPS Next Day Air Saver,9800.00,84.30,9.95,19.00,6.80,120.05
PP-2026-09-B,1Z7A3B9C0499990034,2026-09-18,UPS Ground,4200.00,28.60,3.40,0.00,2.00,34.00
PP-2026-09-B,1Z9Q9Q9Q0400001111,2026-09-19,UPS 2nd Day Air,2500.00,41.10,4.90,0.00,1.75,47.75
`;
// Labels our ledger knows about that are NOT on the bill above (→ "ours but unbilled", probably next bill)
export const VOIDED_LABEL_SEED = [{ trackingNumber: '1Z7A3B9C0499990034', ref: 'E01062', kind: 'inbound' as const, carrier: 'UPS', service: 'UPS Ground', cost: 34, createdAt: '2026-09-18T14:05:00.000Z', voidedAt: '2026-09-18T16:40:00.000Z', who: 'Vienna' }];
export const EXTRA_LEDGER_SEED = [
  { trackingNumber: '1Z7A3B9C0412345699', ref: 'E01058', kind: 'inbound' as const, carrier: 'UPS', service: 'UPS Next Day Air Saver', cost: 101.05, createdAt: '2026-09-20T10:12:00.000Z', who: 'Vienna' },
  { trackingNumber: '1Z7A3B9C0412345720', ref: 'E01066', kind: 'inbound' as const, carrier: 'UPS', service: 'UPS Next Day Air Saver', cost: 96.4, createdAt: '2026-09-26T11:30:00.000Z', who: 'MH' },
];
