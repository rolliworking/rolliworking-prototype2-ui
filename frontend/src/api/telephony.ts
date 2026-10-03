// Telephony adapter — the ONE file a real Vonage Business webhook / client SDK replaces (same seam pattern as Parcel Pro).
// Carrier events → src/api/calls.ts: callRinging → callAnswered | callMissed → callEnded. Dev menu drives timed simulations (MOCK — no carrier involved).
import * as calls from './calls';

const ANSWER_AFTER_MS = 3500; const MISSED_AFTER_MS = 7000; const ELSEWHERE_AFTER_MS = 2500;
const timers = new Map<string, number>();
const later = (callId: string, ms: number, fn: () => void) => { timers.set(callId, window.setTimeout(() => { timers.delete(callId); try { fn(); } catch { /* call already handled at this station */ } }, ms)); };
const cancel = (callId: string) => { const t = timers.get(callId); if (t) { window.clearTimeout(t); timers.delete(callId); } };

// Inbound ring → someone picks up the handset here (mock: auto-answer after a few seconds unless the user answers / the scenario says otherwise)
export const simulateIncoming = (scenario: calls.Scenario) => {
  const s = calls.callRinging({ number: calls.scenarioNumber(scenario) });
  if (scenario === 'missed') later(s.callId, MISSED_AFTER_MS, () => calls.callMissed(s.callId, { voicemail: false }));
  else if (scenario === 'answered_elsewhere') later(s.callId, ELSEWHERE_AFTER_MS, () => { calls.callAnswered(s.callId, { by: 'Vienna', station: 'Front Desk 2' }); later(s.callId, 6000, () => calls.callEnded(s.callId)); });
  else later(s.callId, ANSWER_AFTER_MS, () => calls.callAnswered(s.callId));
  return s;
};
export const simulateVoicemailUnknown = () => { const s = calls.callRinging({ number: '954-555-0182' }); later(s.callId, MISSED_AFTER_MS, () => calls.callMissed(s.callId, { voicemail: true })); return s; };
// Calls → "Simulate incoming call" panel (NOT-KEEPER): any number (seeded client or unknown) + outcome → same D-405 screen-pop + call row as the webhook would produce
export type SimOutcome = 'answered_here' | 'missed' | 'voicemail' | 'answered_elsewhere';
export const simulateIncomingNumber = (number: string, outcome: SimOutcome = 'answered_here') => {
  const n = number.trim(); if (n.replace(/\D/g, '').length < 7) throw new Error('Enter a phone number (7+ digits)');
  const s = calls.callRinging({ number: n });
  if (outcome === 'missed' || outcome === 'voicemail') later(s.callId, MISSED_AFTER_MS, () => calls.callMissed(s.callId, { voicemail: outcome === 'voicemail' }));
  else if (outcome === 'answered_elsewhere') later(s.callId, ELSEWHERE_AFTER_MS, () => { calls.callAnswered(s.callId, { by: 'Vienna', station: 'Front Desk 2' }); later(s.callId, 6000, () => calls.callEnded(s.callId)); });
  else later(s.callId, ANSWER_AFTER_MS, () => calls.callAnswered(s.callId));
  return s;
};
// Handset picked up at THIS station (the card's Answer button) — stops the mock timer
export const answerHere = (callId: string) => { cancel(callId); return calls.callAnswered(callId); };
// Handset down (the card's Hang up button)
export const hangUp = (callId: string) => { cancel(callId); return calls.callEnded(callId); };
// Click-to-call: originate from the signed-in user's extension
export const dial = (input: { clientId?: string; number?: string; jobId?: string }) => calls.startOutboundCall(input);

// ---- Outbound SMS — MOCK of the Vonage Messages API (Pickup Station code resend). Returns a carrier-style receipt; client.ts logs it to the SO timeline + Sent. ----
export interface SmsReceipt { id: string; to: string; maskedTo: string; text: string; at: string; status: 'queued' | 'failed'; provider: 'vonage-mock' }
const smsLedger: SmsReceipt[] = [];
export const maskPhone = (n: string) => { const d = n.replace(/\D/g, ''); return d.length >= 4 ? `•••-•••-${d.slice(-4)}` : '(no phone on file)'; };
export const sendSms = (to: string, text: string): SmsReceipt => {
  const ok = to.replace(/\D/g, '').length >= 7;
  const r: SmsReceipt = { id: `sms-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, to, maskedTo: maskPhone(to), text, at: new Date().toISOString(), status: ok ? 'queued' : 'failed', provider: 'vonage-mock' };
  smsLedger.unshift(r);
  return r;
};
export const smsLog = (): SmsReceipt[] => [...smsLedger];
