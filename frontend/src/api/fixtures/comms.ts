import type { ConvMessage, Conversation } from '../types';
import { seedPhoto } from './intake';
import { daysAgo, hoursAgo } from './time';

const msg = (id: string, conversationId: string, clientId: string, direction: ConvMessage['direction'], source: ConvMessage['source'], by: string, text: string, at: string, extra: Partial<ConvMessage> = {}): ConvMessage => ({ id, conversationId, clientId, direction, source, by, text, at, readByStaff: direction !== 'in', ...extra });

export const conversations: Conversation[] = [
  // Harrison — anchored to job j-01 · NEEDS REPLY (inbound matched by reply token) · assigned to Vienna
  { id: 'cv-01', clientId: 'c-01', subject: 'Submariner service — progress', anchor: { kind: 'job', id: 'j-01' }, status: 'open', tags: ['vienna'], division: 'rolliworks', createdAt: daysAgo(6, 9), lastAt: hoursAgo(5), lastInboundAt: hoursAgo(5), lastOutboundAt: daysAgo(2, 10), tokenSeq: 2 },
  // Grace — anchored to estimate e-12 · SNOOZED until +2d · email reply source
  { id: 'cv-03', clientId: 'c-14', subject: 'Black Bay estimate questions', anchor: { kind: 'estimate', id: 'e-12' }, status: 'snoozed', lane: 'quoted', division: 'rolliworks', createdAt: daysAgo(4, 11), lastAt: daysAgo(1, 16), lastInboundAt: daysAgo(1, 16), lastOutboundAt: daysAgo(3, 10), snoozedUntil: daysAgo(-2, 9), snoozedBy: 'Vienna', tokenSeq: 1 },
  // Eleanor — anchored to estimate e-02 · approval event mid-thread · open, last message outbound (no reply needed)
  { id: 'cv-04', clientId: 'c-02', subject: 'Daytona estimate E01042', anchor: { kind: 'estimate', id: 'e-02' }, status: 'open', division: 'rolliworks', createdAt: daysAgo(9, 10), lastAt: daysAgo(1, 12), lastInboundAt: daysAgo(2, 15), lastOutboundAt: daysAgo(1, 12), tokenSeq: 2 },
  // Requests are intake records, not conversations (MH 2026-10-02): Robert's R4 web request (rq-r4), Naomi's RQ-26-0043 (rq-03) and Harrison's kiosk check-in live on /requests only — no Inbox rows.
  // Robert Calloway — R3 open thread answered · R1 closed history
  { id: 'cv-r3', clientId: 'c-30', subject: 'Datejust 41 service — crystal question', anchor: { kind: 'job', id: 'j-r3' }, status: 'closed', division: 'rolliworks', createdAt: daysAgo(6, 18), lastAt: daysAgo(5, 10), lastInboundAt: daysAgo(6, 18), lastOutboundAt: daysAgo(5, 10), tokenSeq: 1, closedAt: daysAgo(4, 9), closedBy: 'MH' },
  { id: 'cv-r1', clientId: 'c-30', subject: 'Submariner Date — ready for collection', anchor: { kind: 'job', id: 'j-r1' }, status: 'closed', division: 'rolliworks', createdAt: daysAgo(351, 12), lastAt: daysAgo(349, 15), lastInboundAt: daysAgo(349, 15), lastOutboundAt: daysAgo(351, 12), tokenSeq: 1, closedAt: daysAgo(349, 16) },
  // ---- Inbox job-card seeds (2026-10-01) — every anchor case visible at once ----
  // 1 · Rebecca Halloran — ONE active job (W green · B red · P blue) — thread on the job
  { id: 'cv-ib1', clientId: 'c-24', subject: 'GMT-Master — bracelet parts timing', anchor: { kind: 'job', id: 'j-ib1' }, status: 'open', tags: ['vienna'], division: 'rolliworks', createdAt: daysAgo(1, 9), lastAt: hoursAgo(2), lastInboundAt: hoursAgo(3), lastOutboundAt: hoursAgo(2), tokenSeq: 2 },
  // 2 · Victoria Rosenthal — TWO active jobs (E02033 + warranty E02026) — thread on E02033; the other shows beneath in the panel
  { id: 'cv-ib2', clientId: 'c-18', subject: 'Daytona service — ready this week?', anchor: { kind: 'job', id: 'j-32' }, status: 'open', lane: 'answered', division: 'rolliworks', createdAt: hoursAgo(7), lastAt: hoursAgo(6), lastInboundAt: hoursAgo(7), lastOutboundAt: hoursAgo(6), tokenSeq: 1 },
  // 3 · Oliver Pemberton — active E02030 + COMPLETED E02019 (picked up) — thread on the completed one
  { id: 'cv-ib3', clientId: 'c-15', subject: 'E02019 — which strap did you fit at pickup?', anchor: { kind: 'job', id: 'j-09' }, status: 'open', tags: ['chyna', 'update_wo'], division: 'rolliworks', createdAt: hoursAgo(26), lastAt: hoursAgo(25), lastInboundAt: hoursAgo(26), lastOutboundAt: hoursAgo(25), tokenSeq: 1 },
  // 4 · Robert Calloway — RETURN / warranty job E02081 (returned from E01871) — thread on the return job
  { id: 'cv-ib4', clientId: 'c-30', subject: 'Submariner is back — crown will not screw down', anchor: { kind: 'job', id: 'j-wr1' }, status: 'open', pinned: true, division: 'rolliworks', createdAt: daysAgo(2, 10), lastAt: hoursAgo(19), lastInboundAt: hoursAgo(20), lastOutboundAt: hoursAgo(19), tokenSeq: 2 },
  // 5 · Priya Raghunathan — NO anchor (general question) — panel falls back to the Client 360 summary
  { id: 'cv-ib5', clientId: 'c-04', subject: 'Insurance appraisal letter for my collection', status: 'open', lane: 'quoted', division: 'rolliworks', createdAt: hoursAgo(30), lastAt: hoursAgo(28), lastInboundAt: hoursAgo(30), lastOutboundAt: hoursAgo(28), tokenSeq: 1 },
];

export const convMessages: ConvMessage[] = [
  msg('cm-r3a', 'cv-r3', 'c-30', 'in', 'portal', 'Robert Calloway', 'Quick one on the Datejust — is the new crystal the same domed profile as the original?', daysAgo(6, 18), { readByStaff: true }),
  msg('cm-r3b', 'cv-r3', 'c-30', 'out', 'staff', 'MH', 'Yes — genuine flat sapphire with the cyclops, identical to what came off. It is on order from RSC; the movement service continues meanwhile so no time is lost.', daysAgo(5, 10), { token: 'RT-CVR3-1', station: 'Front Desk 1' }),
  msg('cm-r1a', 'cv-r1', 'c-30', 'out', 'staff', 'Vienna', 'Robert — the Submariner has cleared QC and is ready for collection. Your pickup code is in the invoice email.', daysAgo(351, 12), { token: 'RT-CVR1-1', station: 'Front Desk 1' }),
  msg('cm-r1b', 'cv-r1', 'c-30', 'in', 'email', 'Robert Calloway', 'Collected today — it looks brand new. Thank you all.', daysAgo(349, 15), { matchedToken: 'RT-CVR1-1', readByStaff: true }),
  msg('cm-01', 'cv-01', 'c-01', 'out', 'staff', 'Vienna', 'Hello Harrison,\n\nA watchmaker has opened the case on your Rolex Submariner. We’ll update you when it reaches final testing.\n\n— The RolliSuite team', daysAgo(6, 9), { token: 'RT-CV01-1', templateKey: 'job_in_progress', station: 'Front Desk 1', emailId: 'ob-01' }),
  msg('cm-02', 'cv-01', 'c-01', 'in', 'portal', 'Harrison Whitfield', 'Thanks — any chance it will be ready before the 20th? Traveling then.', daysAgo(4, 14), { readByStaff: true }),
  msg('cm-03', 'cv-01', 'c-01', 'out', 'staff', 'Vienna', 'We are aiming for the 18th; I will confirm once it clears QC.', daysAgo(2, 10), { token: 'RT-CV01-2', station: 'Front Desk 1' }),
  msg('cm-04', 'cv-01', 'c-01', 'internal', 'note', 'MM', 'Mainspring on order (PR-0042) — don’t promise the 18th until it lands.', daysAgo(2, 11), { station: 'Watchmaker Room' }),
  msg('cm-05', 'cv-01', 'c-01', 'in', 'email', 'Harrison Whitfield', 'Perfect, the 18th works. Should I bring the box and papers when I collect?', hoursAgo(5), { matchedToken: 'RT-CV01-2', readByStaff: false }),
  msg('cm-07', 'cv-03', 'c-14', 'out', 'staff', 'Vienna', 'Hello Grace,\n\nHere is your estimate E01052 for your Tudor Black Bay 58. Reply to approve, or let us know if you have questions.\n\n— The RolliSuite team', daysAgo(3, 10), { token: 'RT-CV03-1', templateKey: 'estimate_sent', station: 'Front Desk 1' }),
  msg('cm-08', 'cv-03', 'c-14', 'in', 'email', 'Grace Nakamura', 'Is the bracelet refinish included, or is that the separate P line? I will decide after payday on Friday.', daysAgo(1, 16), { matchedToken: 'RT-CV03-1', readByStaff: true }),
  msg('cm-09', 'cv-03', 'c-14', 'internal', 'note', 'Vienna', 'Snoozed until Friday per client — she will approve after payday.', daysAgo(1, 17), { station: 'Front Desk 1' }),
  msg('cm-10', 'cv-04', 'c-02', 'out', 'staff', 'Walter', 'Hello Eleanor,\n\nHere is your estimate E01042 for your Rolex Daytona. Reply to approve, or let us know if you have questions.\n\n— The RolliSuite team', daysAgo(9, 10), { token: 'RT-CV04-1', templateKey: 'estimate_sent', station: 'Front Desk 1' }),
  msg('cm-11', 'cv-04', 'c-02', 'in', 'photo', 'Eleanor Vance', 'Photo submitted from RolliConnect: scratch on the bezel at 10 o’clock', daysAgo(5, 9), { readByStaff: true, photos: [seedPhoto('bezel scratch')], event: { kind: 'photo_submitted', refId: 'e-02', label: 'Photo · E01042' } }),
  msg('cm-12', 'cv-04', 'c-02', 'in', 'approval', 'Eleanor Vance', 'Approved estimate E01042 rev 1 in RolliConnect', daysAgo(2, 15), { readByStaff: true, event: { kind: 'estimate_approved', refId: 'e-02', label: 'Approval · E01042' } }),
  msg('cm-13', 'cv-04', 'c-02', 'out', 'staff', 'Walter', 'Thank you Eleanor — the bezel scratch you photographed needs a P line we had missed, so we revised the estimate (rev 2, $2,850) and re-sent it for your approval.', daysAgo(1, 12), { token: 'RT-CV04-2', station: 'Front Desk 1' }),
  // Inbox job-card seeds
  msg('cm-ib1a', 'cv-ib1', 'c-24', 'out', 'staff', 'Vienna', 'Hello Rebecca — the movement service is under way and the case refinish is done. The bracelet is waiting on two Jubilee links and a clasp spring from RSC (ETA Oct 6); everything else keeps moving.', daysAgo(1, 9), { token: 'RT-CVIB1-1', station: 'Front Desk 1' }),
  msg('cm-ib1b', 'cv-ib1', 'c-24', 'in', 'email', 'Rebecca Halloran', 'Thanks. If the links slip past the 6th, could you release the watch on the old bracelet and fit the links when they land? I travel on the 10th.', hoursAgo(3), { matchedToken: 'RT-CVIB1-1', readByStaff: false }),
  msg('cm-ib2', 'cv-ib2', 'c-18', 'in', 'portal', 'Victoria Rosenthal', 'Hi — is the Daytona (E02033) still on track for this week? And is the other one (E02026) back from testing yet?', hoursAgo(7), { readByStaff: false }),
  msg('cm-ib3', 'cv-ib3', 'c-15', 'in', 'email', 'Oliver Pemberton', 'Quick one on the watch I collected — which strap did you fit at pickup? The box had a second one and I want to keep the original with the papers.', hoursAgo(26), { readByStaff: false }),
  msg('cm-ib4a', 'cv-ib4', 'c-30', 'out', 'staff', 'MH', 'Robert — we have the Submariner back (E02081, linked to last year’s service E01871). Crown tube is being checked under warranty; no charge expected. I will confirm after the bench look.', daysAgo(2, 11), { token: 'RT-CVIB4-1', station: 'Front Desk 1' }),
  msg('cm-ib4b', 'cv-ib4', 'c-30', 'in', 'email', 'Robert Calloway', 'Appreciated. Please keep the original inspection report handy — I would like to compare the before/after crown notes.', hoursAgo(20), { matchedToken: 'RT-CVIB4-1', readByStaff: false }),
  msg('cm-ib5', 'cv-ib5', 'c-04', 'in', 'portal', 'Priya Raghunathan', 'Could you prepare an insurance appraisal letter for the three pieces you have serviced for me over the years? My broker needs it by month end.', hoursAgo(30), { readByStaff: true }),
  // One general Inbox seed: replies so WE spoke last on these (neutral rows); Share-with-staff logged on the Calloway thread
  msg('cm-ib1c', 'cv-ib1', 'c-24', 'out', 'staff', 'Vienna', 'Yes — if the links slip past the 6th we will release the watch on the old bracelet and fit the links the day they land, no extra visit needed.\n\n— Vienna, Rolliworks', hoursAgo(2), { token: 'RT-CVIB1-2', station: 'Front Desk 1' }),
  msg('cm-ib2b', 'cv-ib2', 'c-18', 'out', 'staff', 'Vienna', 'Hi Victoria — the Daytona (E02033) is on track for Thursday; all three parts are at the safes waiting to be reunited. E02026 is in final testing after the hairspring correction — I will confirm both together.\n\n— Vienna, Rolliworks', hoursAgo(6), { token: 'RT-CVIB2-1', station: 'Front Desk 1' }),
  msg('cm-ib3b', 'cv-ib3', 'c-15', 'out', 'staff', 'Chyna', 'Hi Oliver — checking the pickup notes on E02019 now; I will confirm which strap went on and update your work order.\n\n— Chyna, Rolliworks', hoursAgo(25), { token: 'RT-CVIB3-1', station: 'Front Desk 2' }),
  msg('cm-ib4c', 'cv-ib4', 'c-30', 'internal', 'system', 'MH', 'Shared with JV by MH', hoursAgo(19.5), { station: 'Front Desk 1', event: { kind: 'shared', refId: 'cm-ib4b', label: 'Shared with JV' } }),
  msg('cm-ib4d', 'cv-ib4', 'c-30', 'out', 'staff', 'MH', 'Robert — the original E01871 inspection report is attached to this thread and JV is pulling the crown notes before Leo opens it. You will have the before/after side by side.\n\n— MH, Rolliworks', hoursAgo(19), { token: 'RT-CVIB4-2', station: 'Front Desk 1' }),
  msg('cm-ib5b', 'cv-ib5', 'c-04', 'out', 'staff', 'MH', 'Hi Priya — happy to. An insurance appraisal letter for the three pieces is $450 (all three, with photos and current replacement values); allow five working days. Reply yes and we will start.\n\n— MH, Rolliworks', hoursAgo(28), { token: 'RT-CVIB5-1', station: 'Front Desk 1' }),
];
