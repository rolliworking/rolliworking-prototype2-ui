import type { ChatMessage, Part, PartsKnowledgeEntry, PartsRequest } from '../types';
import { daysAgo } from './time';

const P = (id: string, partNumber: string, name: string, category: string, compatibleRefs: string[], calibers: string[], aliases: string[], price: number, stock: number): Part => ({ id, partNumber, name, category, compatibleRefs, calibers, aliases, price, stock });

// Seeded catalog — fake part numbers modelled on Rolex/Tudor conventions. Aliases are the "labels" the approval loop grows.
export const parts: Part[] = [
  P('pt-01', '25-295-C1', 'Crystal, sapphire with cyclops', 'crystal', ['16613', '16610', '16618', '16600'], [], ['crystal', 'glass', 'sapphire', 'cyclops'], 290, 4),
  P('pt-02', '29-5220-0', 'Crystal retaining ring (bezel ring)', 'crystal', ['16613', '16610', '16618', '16800'], [], ['crystal ring', 'retaining ring', 'bezel ring'], 140, 2),
  P('pt-03', '24-7030-0', 'Winding crown, Triplock 7mm', 'crown', ['16613', '16610', '16600', '116610'], [], ['crown', 'triplock', 'winding crown'], 210, 3),
  P('pt-04', '24-7030-T', 'Crown tube, Triplock', 'crown', ['16613', '16610', '116610', '116613'], [], ['tube', 'crown tube', 'case tube'], 95, 5),
  P('pt-05', '3135-330', 'Mainspring, cal. 3135', 'movement', ['16610', '16613', '16200', '16234'], ['3135'], ['mainspring', 'spring', 'barrel spring'], 85, 6),
  P('pt-06', '3135-310', 'Barrel complete, cal. 3135', 'movement', ['16610', '16613', '16200'], ['3135'], ['barrel', 'mainspring barrel'], 260, 1),
  P('pt-07', '3235-330', 'Mainspring, cal. 3235', 'movement', ['126610', '126334', '124300', '126000'], ['3235'], ['mainspring', 'spring'], 95, 3),
  P('pt-08', '3285-310', 'Barrel complete, cal. 3285', 'movement', ['126710', '126711', '126719'], ['3285'], ['barrel', 'mainspring barrel', 'barrel for the gmt'], 310, 0),
  P('pt-09', '4130-360', 'Column wheel, cal. 4130', 'movement', ['116500', '116520', '126500'], ['4130'], ['column wheel', 'chrono wheel'], 420, 1),
  P('pt-10', '4130-8140', 'Pusher seal set, Daytona', 'case', ['116500', '116520', '126500'], ['4130'], ['pusher seals', 'pusher gasket', 'seals'], 60, 8),
  P('pt-11', '29-210-64', 'Case back gasket, 40mm Oyster', 'gasket', ['16610', '16613', '116610', '126610', '16200', '116234'], [], ['gasket', 'case back gasket', 'o-ring', 'back seal'], 18, 20),
  P('pt-12', '29-310-64', 'Crystal gasket, 40mm', 'gasket', ['16610', '16613', '116610', '126610'], [], ['crystal gasket', 'glass gasket'], 22, 12),
  P('pt-13', '78360-580', 'Oyster bracelet end link 580', 'bracelet', ['16610', '16613', '16600'], [], ['end link', 'endlink', 'end piece'], 120, 4),
  P('pt-14', '93150-CL', 'Oysterlock clasp, 93150', 'bracelet', ['16610', '16613', '16600'], [], ['clasp', 'oysterlock', 'buckle'], 380, 2),
  P('pt-15', '72200-SB', 'Bracelet screw, Oyster 20mm', 'bracelet', ['116610', '126610', '116500', '126500', '124300'], [], ['screw', 'bracelet screw', 'link screw'], 28, 30),
  P('pt-16', '77080-SP', 'Spring bar, 20mm curved', 'bracelet', ['16610', '16613', '116610', '126610', '16600', '116234'], [], ['spring bar', 'springbar', 'pin'], 12, 40),
  P('pt-17', '315-24280', 'Bezel insert, black aluminium (16610)', 'bezel', ['16610', '16613'], [], ['bezel insert', 'insert', 'bezel'], 260, 2),
  P('pt-18', '315-24290', 'Bezel insert, blue aluminium (16613)', 'bezel', ['16613', '16618'], [], ['bezel insert', 'blue insert', 'bezel'], 280, 1),
  P('pt-19', '410-16610', 'Hand set, luminous (Submariner 16610)', 'dial', ['16610', '16613'], ['3135'], ['hands', 'hand set', 'lume hands'], 340, 1),
  P('pt-20', 'MT5602-330', 'Mainspring, Tudor MT5602', 'movement', ['79230', '79030', 'M79230N'], ['MT5602'], ['mainspring', 'spring'], 70, 4),
  P('pt-21', '2235-330', 'Mainspring, cal. 2235', 'movement', ['179174', '279171', '178274'], ['2235'], ['mainspring', 'spring'], 75, 5),
  P('pt-22', '2236-360', 'Hairspring, Syloxi cal. 2236', 'movement', ['279171', '279173', '178274'], ['2236'], ['hairspring', 'syloxi', 'balance spring'], 520, 1),
  P('pt-23', '29-200-36', 'Case back gasket, 36mm', 'gasket', ['16200', '16234', '116234', '126234'], [], ['gasket', 'case back gasket', 'o-ring'], 16, 14),
  P('pt-24', '24-6030-0', 'Winding crown, Twinlock 6mm', 'crown', ['16200', '16234', '116234', '126234', '124300'], [], ['crown', 'twinlock', 'winding crown'], 180, 3),
  P('pt-25', 'PM-BZ-PT', 'Bezel refinish kit — platinum (precious metals)', 'bezel', ['228206', '126719'], [], ['platinum bezel', 'pm bezel', 'refinish kit'], 640, 1),
];

const msg = (id: string, role: ChatMessage['role'], text: string, d: number, h: number, suggestions?: ChatMessage['suggestions']): ChatMessage => ({ id, role, text, suggestions, at: daysAgo(d, h) });

export const partsRequests: PartsRequest[] = [
  { id: 'pr-01', number: 'PR-0041', jobId: 'j-04', status: 'approved', partId: 'pt-08', qty: 1, note: 'Barrel bridge shows wear too — check on arrival', searchTerms: ['barrel for the gmt', '3285 barrel'], requestedBy: 'MM', requestedAt: daysAgo(6, 10), station: 'Bench 1', decidedBy: 'Walter', decidedAt: daysAgo(6, 11), decisionNote: 'Order from RSC — parts hold placed',
    chat: [msg('cm-1', 'user', 'barrel for the gmt', 6, 10), msg('cm-2', 'assistant', 'Which GMT? Give me a reference or caliber (e.g. 126710 / 3285) and I’ll narrow it down.', 6, 10), msg('cm-3', 'user', '3285 barrel', 6, 10), msg('cm-4', 'assistant', 'Found 1 match for cal. 3285.', 6, 10, [{ partId: 'pt-08', reason: 'caliber 3285 · barrel' }])] },
  { id: 'pr-02', number: 'PR-0042', jobId: 'j-01', status: 'pending', partId: 'pt-05', qty: 1, searchTerms: ['mainspring 3135'], requestedBy: 'MM', requestedAt: daysAgo(1, 9), station: 'Bench 1',
    chat: [msg('cm-5', 'user', 'mainspring 3135', 1, 9), msg('cm-6', 'assistant', 'Found 1 match for cal. 3135.', 1, 9, [{ partId: 'pt-05', reason: 'caliber 3135 · mainspring' }])] },
  { id: 'pr-03', number: 'PR-0043', jobId: 'j-16', status: 'pending', partId: 'pt-22', qty: 1, note: 'QC fail — amplitude low dial-down', searchTerms: ['hairspring for the lady datejust', 'syloxi 2236'], requestedBy: 'MM', requestedAt: daysAgo(0, 9), station: 'Bench 1',
    chat: [msg('cm-7', 'user', 'hairspring for the lady datejust', 0, 9), msg('cm-8', 'assistant', 'I need a reference or caliber to be sure — the job watch is ref 279171 (cal. 2236). Try “syloxi 2236”.', 0, 9), msg('cm-9', 'user', 'syloxi 2236', 0, 9), msg('cm-10', 'assistant', 'Found 1 match for cal. 2236.', 0, 9, [{ partId: 'pt-22', reason: 'caliber 2236 · hairspring' }])] },
  { id: 'pr-04', number: 'PR-0044', jobId: 'j-03', status: 'rejected', partId: 'pt-17', qty: 1, searchTerms: ['black insert 16613'], requestedBy: 'Walter', requestedAt: daysAgo(3, 14), station: 'Bench 2', decidedBy: 'MM', decidedAt: daysAgo(3, 15), decisionNote: 'Wrong colour — 16613 takes the blue insert; client asked for original spec',
    chat: [msg('cm-11', 'user', 'black insert 16613', 3, 14), msg('cm-12', 'assistant', 'Found 2 matches for ref 16613.', 3, 14, [{ partId: 'pt-17', reason: 'ref 16613 · bezel insert (black)' }, { partId: 'pt-18', reason: 'ref 16613 · bezel insert (blue)' }])] },
];

export const partsKnowledge: PartsKnowledgeEntry[] = [
  { id: 'pk-01', kind: 'association_confirmed', partId: 'pt-08', partNumber: '3285-310', reference: '126710', requestId: 'pr-01', detail: 'Approved on PR-0041 — 3285-310 confirmed for ref 126710', at: daysAgo(6, 11), by: 'Walter', station: 'Front Desk 1' },
  { id: 'pk-02', kind: 'alias_added', partId: 'pt-08', partNumber: '3285-310', alias: 'barrel for the gmt', requestId: 'pr-01', detail: 'Search term "barrel for the gmt" now maps to 3285-310', at: daysAgo(6, 11), by: 'Walter', station: 'Front Desk 1' },
  { id: 'pk-03', kind: 'rejected', partId: 'pt-17', partNumber: '315-24280', reference: '16613', requestId: 'pr-04', detail: 'Rejected on PR-0044 — black insert not the spec for 16613 (client wants blue)', at: daysAgo(3, 15), by: 'MM', station: 'Bench 1' },
];
