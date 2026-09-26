// Parcel Pro adapter — STUB shaped like the real API. The shipping page calls ONLY this module; when the API key exists, this file gets the real implementation.
import type { ShipAddress, ShipCarrierName, TrackingEvent } from '../types';

export interface CreateLabelInput { estimateNumber: string; recipient: ShipAddress; declaredValue: number; carrier: ShipCarrierName }
export interface CreateLabelResult { trackingNumber: string; labelUrl: string; cost: number; insuredValue: number }
export interface TrackingResult { status: string; events: TrackingEvent[]; eta?: string }
export interface AddressValidation { valid: boolean; cleaned: ShipAddress; riskFlag?: string }

const latency = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 350));
const rand = (n: number) => Math.floor(Math.random() * n);

export async function createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  const trackingNumber = input.carrier === 'UPS' ? `1Z${Math.random().toString(36).slice(2, 8).toUpperCase()}${String(rand(1e10)).padStart(10, '0')}` : String(rand(1e12)).padStart(12, '0');
  // Realistic mock: base + insurance (~1% of declared, min $25) + overnight for high values
  const cost = Math.round((18 + Math.max(25, input.declaredValue * 0.0095) + (input.declaredValue > 25_000 ? 25 : 0)) * 100) / 100;
  return latency({ trackingNumber, labelUrl: `https://labels.parcelpro.mock/${input.estimateNumber}/${trackingNumber}.pdf`, cost, insuredValue: input.declaredValue });
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
