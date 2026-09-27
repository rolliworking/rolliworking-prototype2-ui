// Telephony adapter — the ONE file a real Vonage VIP webhook replaces (same seam pattern as Parcel Pro).
// Today: dev-menu simulation → onInboundCall(event) → client.ts receiveInboundCall → screen-pop + comms history row.
import { receiveInboundCall } from './client';
import type { InboundCallEvent, ScreenPop } from './types';

type Listener = (pop: ScreenPop) => void;
const listeners = new Set<Listener>();
export const onScreenPop = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };

export async function onInboundCall(event: InboundCallEvent): Promise<ScreenPop> {
  const pop = await receiveInboundCall(event);
  listeners.forEach((l) => l(pop));
  return pop;
}

// Dev simulation payloads (MOCK — no carrier involved)
export const simulateKnownCall = () => onInboundCall({ number: '(203) 555-0130', at: new Date().toISOString(), direction: 'inbound' }); // Robert Calloway
export const simulateUnknownCall = () => onInboundCall({ number: '954-555-0182', at: new Date().toISOString(), direction: 'inbound' });
