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
  // Robert Calloway — R4 web request needs first reply · R3 open thread answered · R1 closed history
  { id: 'cv-r4', clientId: 'c-30', subject: 'Web request — Explorer II 226570 date jump', anchor: { kind: 'request', id: 'rq-r4' }, status: 'open', division: 'rolliworks', createdAt: hoursAgo(13), lastAt: hoursAgo(13), lastInboundAt: hoursAgo(13), tokenSeq: 0 },
  { id: 'cv-r3', clientId: 'c-30', subject: 'Datejust 41 service — crystal question', anchor: { kind: 'job', id: 'j-r3' }, status: 'open', assignedTo: { type: 'user', shortName: 'MH' }, division: 'rolliworks', createdAt: daysAgo(6, 18), lastAt: daysAgo(5, 10), lastInboundAt: daysAgo(6, 18), lastOutboundAt: daysAgo(5, 10), tokenSeq: 1 },
  { id: 'cv-r1', clientId: 'c-30', subject: 'Submariner Date — ready for collection', anchor: { kind: 'job', id: 'j-r1' }, status: 'closed', assignedTo: { type: 'user', shortName: 'Vienna' }, division: 'rolliworks', createdAt: daysAgo(351, 12), lastAt: daysAgo(349, 15), lastInboundAt: daysAgo(349, 15), lastOutboundAt: daysAgo(351, 12), tokenSeq: 1, closedAt: daysAgo(349, 16) },
  { id: 'cv-05', clientId: 'c-10', subject: 'Web request — Datejust bracelet', anchor: { kind: 'request', id: 'rq-03' }, status: 'open', division: 'rolliworks', createdAt: daysAgo(3, 9), lastAt: daysAgo(3, 9), lastInboundAt: daysAgo(3, 9), tokenSeq: 0 },
  // ---- Inbox job-card seeds (2026-10-01) — every anchor case visible at once ----
  // 1 · Rebecca Halloran — ONE active job (W green · B red · P blue) — thread on the job
  { id: 'cv-ib1', clientId: 'c-24', subject: 'GMT-Master — bracelet parts timing', anchor: { kind: 'job', id: 'j-ib1' }, status: 'open', assignedTo: { type: 'user', shortName: 'Vienna' }, division: 'rolliworks', createdAt: daysAgo(1, 9), lastAt: hoursAgo(3), lastInboundAt: hoursAgo(3), lastOutboundAt: daysAgo(1, 9), tokenSeq: 1 },
  // 2 · Victoria Rosenthal — TWO active jobs (E02033 + warranty E02026) — thread on E02033; the other shows beneath in the panel
  { id: 'cv-ib2', clientId: 'c-18', subject: 'Daytona service — ready this week?', anchor: { kind: 'job', id: 'j-32' }, status: 'open', division: 'rolliworks', createdAt: hoursAgo(7), lastAt: hoursAgo(7), lastInboundAt: hoursAgo(7), tokenSeq: 0 },
  // 3 · Oliver Pemberton — active E02030 + COMPLETED E02019 (picked up) — thread on the completed one
  { id: 'cv-ib3', clientId: 'c-15', subject: 'E02019 — which strap did you fit at pickup?', anchor: { kind: 'job', id: 'j-09' }, status: 'open', assignedTo: { type: 'role', role: 'concierge' }, division: 'rolliworks', createdAt: hoursAgo(26), lastAt: hoursAgo(26), lastInboundAt: hoursAgo(26), tokenSeq: 0 },
  // 4 · Robert Calloway — RETURN / warranty job E02081 (returned from E01871) — thread on the return job
  { id: 'cv-ib4', clientId: 'c-30', subject: 'Submariner is back — crown will not screw down', anchor: { kind: 'job', id: 'j-wr1' }, status: 'open', assignedTo: { type: 'user', shortName: 'MH' }, division: 'rolliworks', createdAt: daysAgo(2, 10), lastAt: hoursAgo(20), lastInboundAt: hoursAgo(20), lastOutboundAt: daysAgo(2, 11), tokenSeq: 1 },
  // 5 · Priya Raghunathan — NO anchor (general question) — panel falls back to the Client 360 summary
  { id: 'cv-ib5', clientId: 'c-04', subject: 'Insurance appraisal letter for my collection', status: 'open', division: 'rolliworks', createdAt: hoursAgo(30), lastAt: hoursAgo(30), lastInboundAt: hoursAgo(30), tokenSeq: 0 },
];

export const convMessages: ConvMessage[] = [
  msg('cm-r4', 'cv-r4', 'c-30', 'in', 'portal', 'Robert Calloway', 'Sent a request through the website about my Explorer II (226570) — the date jumps two days at midnight and the 24-hour hand is off. Happy to drop it off whenever suits.', hoursAgo(13), { readByStaff: false }),
  msg('cm-r3a', 'cv-r3', 'c-30', 'in', 'portal', 'Robert Calloway', 'Quick one on the Datejust — is the new crystal the same domed profile as the original?', daysAgo(6, 18), { readByStaff: true }),
  msg('cm-r3b', 'cv-r3', 'c-30', 'out', 'staff', 'MH', 'Yes — genuine flat sapphire with the cyclops, identical to what came off. It is on order from RSC; the movement service continues meanwhile so no time is lost.', daysAgo(5, 10), { token: 'RT-CVR3-1', station: 'Front Desk 1' }),
  msg('cm-r1a', 'cv-r1', 'c-30', 'out', 'staff', 'Vienna', 'Robert — the Submariner has cleared QC and is ready for collection. Your pickup code is in the invoice email.', daysAgo(351, 12), { token: 'RT-CVR1-1', station: 'Front Desk 1' }),
  msg('cm-r1b', 'cv-r1', 'c-30', 'in', 'email', 'Robert Calloway', 'Collected today — it looks brand new. Thank you all.', daysAgo(349, 15), { matchedToken: 'RT-CVR1-1', readByStaff: true }),
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
  // Inbox job-card seeds
  msg('cm-ib1a', 'cv-ib1', 'c-24', 'out', 'staff', 'Vienna', 'Hello Rebecca — the movement service is under way and the case refinish is done. The bracelet is waiting on two Jubilee links and a clasp spring from RSC (ETA Oct 6); everything else keeps moving.', daysAgo(1, 9), { token: 'RT-CVIB1-1', station: 'Front Desk 1' }),
  msg('cm-ib1b', 'cv-ib1', 'c-24', 'in', 'email', 'Rebecca Halloran', 'Thanks. If the links slip past the 6th, could you release the watch on the old bracelet and fit the links when they land? I travel on the 10th.', hoursAgo(3), { matchedToken: 'RT-CVIB1-1', readByStaff: false }),
  msg('cm-ib2', 'cv-ib2', 'c-18', 'in', 'portal', 'Victoria Rosenthal', 'Hi — is the Daytona (E02033) still on track for this week? And is the other one (E02026) back from testing yet?', hoursAgo(7), { readByStaff: false }),
  msg('cm-ib3', 'cv-ib3', 'c-15', 'in', 'email', 'Oliver Pemberton', 'Quick one on the watch I collected — which strap did you fit at pickup? The box had a second one and I want to keep the original with the papers.', hoursAgo(26), { readByStaff: false }),
  msg('cm-ib4a', 'cv-ib4', 'c-30', 'out', 'staff', 'MH', 'Robert — we have the Submariner back (E02081, linked to last year’s service E01871). Crown tube is being checked under warranty; no charge expected. I will confirm after the bench look.', daysAgo(2, 11), { token: 'RT-CVIB4-1', station: 'Front Desk 1' }),
  msg('cm-ib4b', 'cv-ib4', 'c-30', 'in', 'email', 'Robert Calloway', 'Appreciated. Please keep the original inspection report handy — I would like to compare the before/after crown notes.', hoursAgo(20), { matchedToken: 'RT-CVIB4-1', readByStaff: false }),
  msg('cm-ib5', 'cv-ib5', 'c-04', 'in', 'portal', 'Priya Raghunathan', 'Could you prepare an insurance appraisal letter for the three pieces you have serviced for me over the years? My broker needs it by month end.', hoursAgo(30), { readByStaff: false }),
];
