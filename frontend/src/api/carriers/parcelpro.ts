// Parcel Pro adapter — STUB shaped like the real API. The shipping page calls ONLY this module; when the API key exists, this file gets the real implementation.
import type { ShipAddress, ShipCarrierName, ShipServiceLevel, TrackingEvent } from '../types';

// ONE-LINE SWITCH: set the key (e.g. from import.meta.env.VITE_PARCELPRO_API_KEY) and purchaseLabel() goes live. Everything else in the app is unchanged.
const PARCELPRO_API_KEY: string | undefined = undefined;
export const parcelProMode = (): 'mock' | 'live' => (PARCELPRO_API_KEY ? 'live' : 'mock');

export interface CreateLabelInput { estimateNumber: string; recipient: ShipAddress; declaredValue: number; carrier: ShipCarrierName; serviceLevel?: ShipServiceLevel }
export interface CreateLabelResult { trackingNumber: string; labelUrl: string; cost: number; insuredValue: number; confirmationId: string; service: string; insuranceBound: boolean }
// Real Parcel Pro shape: one request buys the label AND binds insurance for the declared value.
export interface PurchaseLabelRequest { reference: string; shipFrom: ShipAddress; shipTo: ShipAddress; carrier: ShipCarrierName; serviceLevel: ShipServiceLevel; insuredValue: number; signatureRequired: true }
export interface PurchaseLabelResponse { confirmationId: string; trackingNumber: string; labelUrl: string; labelFormat: 'PDF'; carrier: ShipCarrierName; service: string; insured: { bound: boolean; value: number; premium: number }; postage: number; total: number }
export interface TrackingResult { status: string; events: TrackingEvent[]; eta?: string }
export interface AddressValidation { valid: boolean; cleaned: ShipAddress; riskFlag?: string }

const latency = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 350));
const rand = (n: number) => Math.floor(Math.random() * n);
export const SHOP_SHIP_TO: ShipAddress = { name: 'RolliSuite Service Center', street: '590 Madison Avenue, Suite 1802', city: 'New York', state: 'NY', zip: '10022' };
export const serviceName = (carrier: ShipCarrierName, level: ShipServiceLevel) => (carrier === 'UPS' ? (level === '1_day' ? 'UPS Next Day Air' : 'UPS 2nd Day Air') : level === '1_day' ? 'FedEx Priority Overnight' : 'FedEx 2Day');

// Label + insurance in one call (mirrors Parcel Pro's shipment endpoint). Mock: deterministic-looking tracking #, postage by service level, premium ~0.95% of value (min $25).
export async function purchaseLabel(req: PurchaseLabelRequest): Promise<PurchaseLabelResponse> {
  if (parcelProMode() === 'live') throw new Error('Parcel Pro live mode: wire the HTTP call here (POST /v1/shipments with PARCELPRO_API_KEY)');
  const trackingNumber = req.carrier === 'UPS' ? `1Z${Math.random().toString(36).slice(2, 8).toUpperCase()}${String(rand(1e10)).padStart(10, '0')}` : String(rand(1e12)).padStart(12, '0');
  const premium = Math.round(Math.max(25, req.insuredValue * 0.0095) * 100) / 100; const postage = req.serviceLevel === '1_day' ? 42 : 24; const surcharge = req.insuredValue > 25_000 ? 25 : 0;
  return latency({ confirmationId: `PP-${Date.now().toString(36).toUpperCase()}${rand(90) + 10}`, trackingNumber, labelUrl: `https://labels.parcelpro.mock/${req.reference}/${trackingNumber}.pdf`, labelFormat: 'PDF', carrier: req.carrier, service: serviceName(req.carrier, req.serviceLevel), insured: { bound: true, value: req.insuredValue, premium }, postage, total: Math.round((postage + premium + surcharge) * 100) / 100 });
}

export async function createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  const r = await purchaseLabel({ reference: input.estimateNumber, shipFrom: input.recipient, shipTo: SHOP_SHIP_TO, carrier: input.carrier, serviceLevel: input.serviceLevel ?? '1_day', insuredValue: input.declaredValue, signatureRequired: true });
  return { trackingNumber: r.trackingNumber, labelUrl: r.labelUrl, cost: r.total, insuredValue: r.insured.value, confirmationId: r.confirmationId, service: r.service, insuranceBound: r.insured.bound };
}

export async function voidLabel(trackingNumber: string): Promise<{ voided: boolean; trackingNumber: string }> { return latency({ voided: true, trackingNumber }); }

export async function getTracking(trackingNumber: string, events: TrackingEvent[] = []): Promise<TrackingResult> {
  const last = events[events.length - 1];
  return latency({ status: last?.status ?? (trackingNumber ? 'Label created' : 'No label'), events, eta: last && /out for delivery/i.test(last.status) ? new Date().toISOString() : undefined });
}

const STATE_ZIP: Record<string, string> = { NY: '10022', CA: '90210', IL: '60611', TX: '75201', FL: '33139', WA: '98101', MA: '02116', NJ: '07030', CT: '06830', PA: '19103' };
export async function validateAddress(address: ShipAddress): Promise<AddressValidation> {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/\b(street|st\.?)$/i, 'St').replace(/\b(avenue|ave\.?)$/i, 'Ave').replace(/\b(road|rd\.?)$/i, 'Rd');
  const cleaned: ShipAddress = { name: address.name.trim(), street: clean(address.street), city: address.city.trim().replace(/\b\w/g, (c) => c.toUpperCase()), state: address.state.trim().toUpperCase(), zip: address.zip?.trim() || STATE_ZIP[address.state.trim().toUpperCase()] || '00000' };
  const valid = !!cleaned.street && !!cleaned.city && cleaned.state.length === 2;
  return latency({ valid, cleaned, riskFlag: !valid ? 'Incomplete address' : /po box/i.test(cleaned.street) ? 'PO Box — carrier will not insure' : undefined });
}
