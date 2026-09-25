import type { ConvMessage, Conversation } from '../types';
import { seedPhoto } from './intake';
import { daysAgo, hoursAgo } from './time';

const msg = (id: string, conversationId: string, clientId: string, direction: ConvMessage['direction'], source: ConvMessage['source'], by: string, text: string, at: string, extra: Partial<ConvMessage> = {}): ConvMessage => ({ id, conversationId, clientId, direction, source, by, text, at, readByStaff: direction !== 'in', ...extra });

export const conversations: Conversation[] = [
  // Harrison — anchored to job j-01 · NEEDS REPLY (inbound matched by reply token) · assigned to Vienna
  { id: 'cv-01', clientId: 'c-01', subject: 'Submariner service — progress', anchor: { kind: 'job', id: 'j-01' }, status: 'open', assignedTo: { type: 'user', shortName: 'Vienna' }, division: 'rolliworks', createdAt: daysAgo(6, 9), lastAt: hoursAgo(5), lastInboundAt: hoursAgo(5), lastOutboundAt: daysAgo(2, 10), tokenSeq: 2 },
  // Harrison — kiosk submission, general folder thread, closed
  { id: 'cv-02', clientId: 'c-01', subject: 'Kiosk check-in — dropped off Submariner', status: 'closed', division: 'rolliworks', createdAt: daysAgo(6, 8), lastAt: daysAgo(6, 8), lastInboundAt: daysAgo(6, 8), closedAt: daysAgo(6, 9), closedBy: 'Vienna', tokenSeq: 0 },
  // Grace — anchored to estimate e-12 · SNOOZED until +2d · email reply source
  { id: 'cv-03', clientId: 'c-14', subject: 'Black Bay estimate questions', anchor: { kind: 'estimate', id: 'e-12' }, status: 'snoozed', assignedTo: { type: 'role', role: 'concierge' }, division: 'rolliworks', createdAt: daysAgo(4, 11), lastAt: daysAgo(1, 16), lastInboundAt: daysAgo(1, 16), lastOutboundAt: daysAgo(3, 10), snoozedUntil: daysAgo(-2, 9), snoozedBy: 'Vienna', tokenSeq: 1 },
  // Eleanor — anchored to estimate e-02 · approval event mid-thread · open, last message outbound (no reply needed)
  { id: 'cv-04', clientId: 'c-02', subject: 'Daytona estimate E01042', anchor: { kind: 'estimate', id: 'e-02' }, status: 'open', assignedTo: { type: 'user', shortName: 'Walter' }, division: 'rolliworks', createdAt: daysAgo(9, 10), lastAt: daysAgo(1, 12), lastInboundAt: daysAgo(2, 15), lastOutboundAt: daysAgo(1, 12), tokenSeq: 2 },
  // Naomi — request rq-03 anchored, unassigned, needs reply (older)
  { id: 'cv-05', clientId: 'c-10', subject: 'Web request — Datejust bracelet', anchor: { kind: 'request', id: 'rq-03' }, status: 'open', division: 'rolliworks', createdAt: daysAgo(3, 9), lastAt: daysAgo(3, 9), lastInboundAt: daysAgo(3, 9), tokenSeq: 0 },
];

export const convMessages: ConvMessage[] = [
  msg('cm-01', 'cv-01', 'c-01', 'out', 'staff', 'Vienna', 'Hello Harrison,\n\nA watchmaker has opened the case on your Rolex Submariner. We’ll update you when it reaches final testing.\n\n— The RolliSuite team', daysAgo(6, 9), { token: 'RT-CV01-1', templateKey: 'job_in_progress', station: 'Front Desk 1', emailId: 'ob-01' }),
  msg('cm-02', 'cv-01', 'c-01', 'in', 'portal', 'Harrison Whitfield', 'Thanks — any chance it will be ready before the 20th? Traveling then.', daysAgo(4, 14), { readByStaff: true }),
  msg('cm-03', 'cv-01', 'c-01', 'out', 'staff', 'Vienna', 'We are aiming for the 18th; I will confirm once it clears QC.', daysAgo(2, 10), { token: 'RT-CV01-2', station: 'Front Desk 1' }),
  msg('cm-04', 'cv-01', 'c-01', 'internal', 'note', 'MM', 'Mainspring on order (PR-0042) — don’t promise the 18th until it lands.', daysAgo(2, 11), { station: 'Watchmaker Room' }),
  msg('cm-05', 'cv-01', 'c-01', 'in', 'email', 'Harrison Whitfield', 'Perfect, the 18th works. Should I bring the box and papers when I collect?', hoursAgo(5), { matchedToken: 'RT-CV01-2', readByStaff: false }),
  msg('cm-06', 'cv-02', 'c-01', 'in', 'kiosk', 'Harrison Whitfield', 'Kiosk check-in: dropped off Rolex Submariner 126610LN · contents: watch, box · signature captured', daysAgo(6, 8), { readByStaff: true }),
  msg('cm-07', 'cv-03', 'c-14', 'out', 'staff', 'Vienna', 'Hello Grace,\n\nHere is your estimate E01052 for your Tudor Black Bay 58. Reply to approve, or let us know if you have questions.\n\n— The RolliSuite team', daysAgo(3, 10), { token: 'RT-CV03-1', templateKey: 'estimate_sent', station: 'Front Desk 1' }),
  msg('cm-08', 'cv-03', 'c-14', 'in', 'email', 'Grace Nakamura', 'Is the bracelet refinish included, or is that the separate P line? I will decide after payday on Friday.', daysAgo(1, 16), { matchedToken: 'RT-CV03-1', readByStaff: true }),
  msg('cm-09', 'cv-03', 'c-14', 'internal', 'note', 'Vienna', 'Snoozed until Friday per client — she will approve after payday.', daysAgo(1, 17), { station: 'Front Desk 1' }),
  msg('cm-10', 'cv-04', 'c-02', 'out', 'staff', 'Walter', 'Hello Eleanor,\n\nHere is your estimate E01042 for your Rolex Daytona. Reply to approve, or let us know if you have questions.\n\n— The RolliSuite team', daysAgo(9, 10), { token: 'RT-CV04-1', templateKey: 'estimate_sent', station: 'Front Desk 1' }),
  msg('cm-11', 'cv-04', 'c-02', 'in', 'photo', 'Eleanor Vance', 'Photo submitted from RolliConnect: scratch on the bezel at 10 o’clock', daysAgo(5, 9), { readByStaff: true, photos: [seedPhoto('bezel scratch')], event: { kind: 'photo_submitted', refId: 'e-02', label: 'Photo · E01042' } }),
  msg('cm-12', 'cv-04', 'c-02', 'in', 'approval', 'Eleanor Vance', 'Approved estimate E01042 rev 1 in RolliConnect', daysAgo(2, 15), { readByStaff: true, event: { kind: 'estimate_approved', refId: 'e-02', label: 'Approval · E01042' } }),
  msg('cm-13', 'cv-04', 'c-02', 'out', 'staff', 'Walter', 'Thank you Eleanor — the bezel scratch you photographed needs a P line we had missed, so we revised the estimate (rev 2, $2,850) and re-sent it for your approval.', daysAgo(1, 12), { token: 'RT-CV04-2', station: 'Front Desk 1' }),
  msg('cm-14', 'cv-05', 'c-10', 'in', 'portal', 'Naomi Castellanos', 'Web request RQ-26-0043: my Datejust bracelet has stretch and one pin keeps backing out — can this be fixed without a new bracelet?', daysAgo(3, 9), { readByStaff: false }),
];
