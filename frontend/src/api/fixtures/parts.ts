import type { ChatMessage, M3keEvent, Part, PartsKnowledgeEntry, PartsRequest } from '../types';
import { daysAgo } from './time';

const P = (id: string, partNumber: string, name: string, category: string, compatibleRefs: string[], calibers: string[], aliases: string[], price: number, stock: number): Part => ({ id, partNumber, name, category, compatibleRefs, calibers, aliases, price, stock });

// Seeded catalog — fake part numbers modelled on Rolex/Tudor conventions. Aliases are the "labels" the approval loop grows.
export const parts: Part[] = [
  P('pt-01', '25-295-C1', 'Crystal, sapphire with cyclops', 'crystal', ['16613', '16610', '16618', '16600'], [], ['crystal', 'glass', 'sapphire', 'cyclops'], 290, 4),
  P('pt-02', '25-16610', 'Crystal ring (retaining), Submariner 16610/16613', 'crystal', ['16613', '16610', '16618', '16800'], [], ['retaining ring', 'bezel ring'], 140, 2),
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
  P('pt-16', '77080-SP', 'Spring bar, 20mm curved', 'bracelet', ['16610', '16613', '116610', '126610', '16600', '116234'], [], ['spring bar', 'springbar', 'pin'], 12, 1),
  P('pt-17', '315-24280', 'Bezel insert, black aluminium (16610)', 'bezel', ['16610', '16613'], [], ['bezel insert', 'insert', 'bezel'], 260, 2),
  P('pt-18', '315-24290', 'Bezel insert, blue aluminium (16613)', 'bezel', ['16613', '16618'], [], ['bezel insert', 'blue insert', 'bezel'], 280, 1),
  P('pt-19', '410-16610', 'Hand set, luminous (Submariner 16610)', 'dial', ['16610', '16613'], ['3135'], ['hands', 'hand set', 'lume hands'], 340, 1),
  P('pt-20', 'MT5602-330', 'Mainspring, Tudor MT5602', 'movement', ['79230', '79030', 'M79230N'], ['MT5602'], ['mainspring', 'spring'], 70, 4),
  P('pt-21', '2235-330', 'Mainspring, cal. 2235', 'movement', ['179174', '279171', '178274'], ['2235'], ['mainspring', 'spring'], 75, 5),
  P('pt-22', '2236-360', 'Hairspring, Syloxi cal. 2236', 'movement', ['279171', '279173', '178274'], ['2236'], ['hairspring', 'syloxi', 'balance spring'], 520, 1),
  P('pt-23', '29-200-36', 'Case back gasket, 36mm', 'gasket', ['16200', '16234', '116234', '126234'], [], ['gasket', 'case back gasket', 'o-ring'], 16, 14),
  P('pt-24', '24-6030-0', 'Winding crown, Twinlock 6mm', 'crown', ['16200', '16234', '116234', '126234', '124300'], [], ['crown', 'twinlock', 'winding crown'], 180, 3),
  P('pt-25', 'PM-BZ-PT', 'Bezel refinish kit — platinum (precious metals)', 'bezel', ['228206', '126719'], [], ['platinum bezel', 'pm bezel', 'refinish kit'], 640, 1),
  P('pt-26', '315-126710-BB', 'Bezel insert, Cerachrom black/blue (GMT 126710BLNR)', 'bezel', ['126710', '126710BLNR'], [], ['black/blue gmt insert', 'batman insert', 'bezel insert', 'blnr insert'], 690, 2),
  P('pt-27', '315-126710-RB', 'Bezel insert, Cerachrom red/blue (GMT 126710BLRO)', 'bezel', ['126710', '126710BLRO'], [], ['pepsi insert', 'red/blue gmt insert', 'bezel insert'], 690, 0),
  P('pt-28', '410-126710', 'Hand set, GMT with green 24h hand', 'dial', ['126710'], ['3285'], ['gmt hands', 'hand set', 'green gmt hand'], 380, 1),
  P('pt-29', '78200-JB', 'Jubilee bracelet link, 20mm', 'bracelet', ['126710', '126334', '126234'], [], ['jubilee link', 'link', 'bracelet link'], 95, 6),
  P('pt-30', '72610-CL', 'Oysterlock clasp, Glidelock (126610)', 'bracelet', ['126610', '126619'], [], ['glidelock', 'clasp', 'sub clasp'], 520, 1),
  P('pt-31', '3135-710', 'Balance complete, cal. 3135', 'movement', ['16610', '16613', '16200'], ['3135'], ['balance', 'balance complete', 'balance wheel'], 780, 1),
  P('pt-32', 'MT5402-330', 'Mainspring, Tudor MT5402', 'movement', ['79030', 'M79030N'], ['MT5402'], ['mainspring', 'spring', 'bb58 spring'], 70, 3),
  // Pad v2 — cal. 3135 movement set (caliber query) + model-specific parts across 16610 / 126710 / 114060
  P('pt-33', '3135-410', 'Reversing wheel set, cal. 3135', 'movement', [], ['3135'], ['reversing wheels', 'reversers'], 190, 3),
  P('pt-34', '3135-420', 'Crown wheel, cal. 3135', 'movement', [], ['3135'], ['crown wheel'], 110, 2),
  P('pt-35', '3135-430', 'Setting lever spring, cal. 3135', 'movement', [], ['3135'], ['setting lever spring', 'yoke spring'], 45, 5),
  P('pt-36', '3135-440', 'Date jumper, cal. 3135', 'movement', [], ['3135'], ['date jumper', 'date click'], 60, 4),
  P('pt-37', '3135-450', 'Escape wheel, cal. 3135', 'movement', [], ['3135'], ['escape wheel'], 240, 1),
  P('pt-38', '3135-460', 'Pallet fork, cal. 3135', 'movement', [], ['3135'], ['pallet fork', 'pallets', 'anchor'], 210, 2),
  P('pt-39', '3135-470', 'Rotor axle, cal. 3135', 'movement', [], ['3135'], ['rotor axle', 'oscillating weight axle'], 130, 3),
  P('pt-40', '3135-480', 'Hairspring, Parachrom cal. 3135', 'movement', [], ['3135'], ['hairspring', 'parachrom', 'balance spring'], 560, 1),
  P('pt-41', '3135-370', 'Reduction wheel, cal. 3135', 'movement', [], ['3135'], ['reduction wheel'], 95, 2),
  P('pt-42', '315-114060', 'Bezel insert, Cerachrom black (Submariner 114060)', 'bezel', ['114060', '14060'], [], ['ceramic insert', 'black insert', 'bezel insert'], 720, 1),
  P('pt-43', '25-114060', 'Crystal, sapphire flat no cyclops (114060 / 14060)', 'crystal', ['114060', '14060'], [], ['crystal', 'flat crystal', 'no-date crystal'], 310, 2),
  P('pt-44', '24-114060', 'Winding crown, Triplock (114060)', 'crown', ['114060', '14060'], [], ['crown', 'triplock'], 230, 2),
  P('pt-45', '410-114060', 'Hand set, Chromalight (114060)', 'dial', ['114060', '14060'], ['3130'], ['hands', 'hand set', 'chromalight hands'], 360, 1),
  P('pt-46', '29-16610-CB', 'Case back, Submariner 16610', 'case', ['16610', '16613'], [], ['case back', 'caseback', 'back'], 480, 1),
  P('pt-47', '24-126710-CR', 'Winding crown, Triplock (GMT 126710)', 'crown', ['126710', '126711', '126719'], [], ['crown', 'gmt crown', 'triplock'], 260, 2),
  P('pt-48', '25-126710', 'Crystal, sapphire with cyclops (GMT 126710)', 'crystal', ['126710', '126711'], [], ['crystal', 'gmt crystal', 'cyclops'], 340, 2),
];

// Reference → caliber (prefix match; longest prefix wins)
export const CALIBER_BY_REF: [string, string][] = [
  ['16610', '3135'], ['16613', '3135'], ['16618', '3135'], ['16600', '3135'], ['116610', '3135'], ['116613', '3135'], ['16200', '3135'], ['16234', '3135'],
  ['126610', '3235'], ['126334', '3235'], ['126600', '3235'], ['126234', '3235'], ['126622', '3235'], ['126000', '3230'], ['124300', '3230'], ['124270', '3230'],
  ['114060', '3130'], ['14060', '3130'], ['116500', '4130'], ['116520', '4130'], ['126500', '4131'], ['228238', '3255'], ['228206', '3255'],
  ['126710', '3285'], ['126711', '3285'], ['126719', '3285'], ['278274', '2236'], ['279174', '2236'], ['279171', '2236'], ['179174', '2235'],
  ['M79030', 'MT5402'], ['M79830', 'MT5652'], ['M25600', 'MT5612'], ['M79360', 'MT5813'], ['M79540', 'MT5602'], ['M79230', 'MT5602'],
];
export const caliberForReference = (ref: string): string | undefined => { const r = ref.toUpperCase(); return CALIBER_BY_REF.filter(([p]) => r.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0]?.[1]; };

// M3KE — append-only learning log. One pre-learned mapping so the "learned" tag is visible on the first walk.
export const m3keEvents: M3keEvent[] = [
  { id: 'm3-01', kind: 'resolved', description: 'bezel insert black', reference: '16610', caliber: '3135', partId: 'pt-17', partNumber: '315-24280', price: 260, resolvedBy: 'MH', ts: daysAgo(9, 15), requestId: 'pr-04' },
  { id: 'm3-02', kind: 'selected', description: 'mainspring', reference: '16610', caliber: '3135', partId: 'pt-05', partNumber: '3135-330', price: 85, resolvedBy: 'MM', ts: daysAgo(5, 10) },
];
const LOCATIONS: Record<string, string> = { 'pt-01': 'Cabinet A · Drawer 1 · Bin 1', 'pt-02': 'Cabinet A · Drawer 1 · Bin 2', 'pt-03': 'Cabinet A · Drawer 2 · Bin 1', 'pt-04': 'Cabinet A · Drawer 2 · Bin 2', 'pt-05': 'Cabinet A · Drawer 6 · Bin 1', 'pt-06': 'Cabinet A · Drawer 7 · Bin 1', 'pt-07': 'Cabinet A · Drawer 6 · Bin 2', 'pt-08': 'Cabinet A · Drawer 7 · Bin 2', 'pt-09': 'Cabinet A · Drawer 8 · Bin 1', 'pt-10': 'Cabinet B · Drawer 2 · Bin 3', 'pt-11': 'Cabinet A · Drawer 3 · Bin 2', 'pt-12': 'Cabinet A · Drawer 3 · Bin 3', 'pt-13': 'Cabinet C · Drawer 2 · Bin 1', 'pt-14': 'Cabinet C · Drawer 2 · Bin 4', 'pt-15': 'Cabinet C · Drawer 1 · Bin 2', 'pt-16': 'Cabinet C · Drawer 1 · Bin 9', 'pt-17': 'Cabinet B · Drawer 12 · Bin 4', 'pt-18': 'Cabinet B · Drawer 12 · Bin 5', 'pt-19': 'Cabinet B · Drawer 9 · Bin 1', 'pt-20': 'Cabinet A · Drawer 6 · Bin 4', 'pt-21': 'Cabinet A · Drawer 6 · Bin 5', 'pt-22': 'Cabinet A · Drawer 9 · Bin 1', 'pt-23': 'Cabinet A · Drawer 3 · Bin 4', 'pt-24': 'Cabinet A · Drawer 2 · Bin 3', 'pt-25': 'Safe 2 · Shelf 1', 'pt-26': 'Cabinet B · Drawer 13 · Bin 1', 'pt-27': 'Cabinet B · Drawer 13 · Bin 2', 'pt-28': 'Cabinet B · Drawer 9 · Bin 3', 'pt-29': 'Cabinet C · Drawer 3 · Bin 1', 'pt-30': 'Cabinet C · Drawer 2 · Bin 6', 'pt-31': 'Cabinet A · Drawer 8 · Bin 3', 'pt-32': 'Cabinet A · Drawer 6 · Bin 6' };
parts.forEach((p) => { p.location = LOCATIONS[p.id]; });


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
  // Pad history seed — 12 past requests across statuses (room jobs)
  ...([
    ['pr-h01', 'PR-0030', 'j-01', 'received', 'pt-11', 1, 'MM', 21, 'pad'], ['pr-h02', 'PR-0031', 'j-03', 'approved', 'pt-17', 1, 'Walter', 19, 'wm'], ['pr-h03', 'PR-0032', 'j-04', 'declined', 'pt-08', 1, 'MM', 18, 'pad'],
    ['pr-h04', 'PR-0033', 'j-06', 'received', 'pt-05', 1, 'MM', 17, 'pad'], ['pr-h05', 'PR-0034', 'j-06', 'approved', 'pt-02', 1, 'MM', 16, 'pad'], ['pr-h06', 'PR-0035', 'j-16', 'on_order', 'pt-22', 1, 'MM', 14, 'wm'],
    ['pr-h07', 'PR-0036', 'j-24', 'received', 'pt-31', 1, 'Rosa', 12, 'wm'], ['pr-h08', 'PR-0037', 'j-30', 'awaiting_client', 'pt-26', 1, 'MM', 11, 'pad'], ['pr-h09', 'PR-0038', 'j-31', 'approved', 'pt-16', 2, 'Walter', 9, 'wm'],
    ['pr-h10', 'PR-0039', 'j-32', 'declined', 'pt-14', 1, 'Rosa', 8, 'pad'], ['pr-h11', 'PR-0040', 'j-05', 'received', 'pt-13', 1, 'Walter', 7, 'wm'], ['pr-h12', 'PR-0049', 'j-01', 'pending_review', 'pt-40', 1, 'MM', 2, 'pad'],
  ] as [string, string, string, PartsRequest['status'], string, number, string, number, PartsRequest['source']][]).map(([id, number, jobId, status, partId, qty, by, d, source]): PartsRequest => {
    const p = parts.find((x) => x.id === partId)!; const hist = [{ at: daysAgo(d, 9), by, station: 'Watchmaker Room', action: `requested · ${p.name} ×${qty}` }];
    if (status !== 'pending_review') hist.push({ at: daysAgo(d, 11), by: 'MH', station: 'Front Desk 1', action: status === 'declined' ? 'declined at review' : 'priced + sent for client approval' });
    if (['approved', 'received', 'on_order'].includes(status)) hist.push({ at: daysAgo(Math.max(0, d - 1), 10), by: 'client', station: 'RolliConnect', action: 'client approved' });
    if (status === 'received') hist.push({ at: daysAgo(Math.max(0, d - 2), 9), by: 'Vienna', station: 'Front Desk 1', action: 'received · picked' }); if (status === 'on_order') hist.push({ at: daysAgo(Math.max(0, d - 1), 14), by: 'MM', station: 'Watchmaker Room', action: 'out of stock → on order' });
    return { id, number, jobId, status, partId, qty, searchTerms: [p.name], chat: [], requestedBy: by, requestedAt: daysAgo(d, 9), station: 'Watchmaker Room', source, items: [{ partId, partNumber: p.partNumber, description: p.name, qty, price: p.price }], history: hist, decidedBy: status === 'pending_review' ? undefined : 'MH', decidedAt: status === 'pending_review' ? undefined : daysAgo(d, 11), allocatedAt: status === 'received' ? daysAgo(Math.max(0, d - 2), 9) : undefined };
  }),
  // Pad v2 — GENERIC request sitting in Manager review (16610 · cal. 3135)
  { id: 'pr-20', number: 'PR-0050', jobId: 'j-06', status: 'pending_review', qty: 1, note: 'crystal ring for 16610', searchTerms: ['crystal ring for 16610'], requestedBy: 'MM', requestedAt: daysAgo(0, 7), station: 'Watchmaker Room', source: 'pad', reference: '16610', caliber: '3135',
    items: [{ description: 'crystal ring for 16610', qty: 1, generic: true }, { partId: 'pt-11', partNumber: '29-210-64', description: 'Case back gasket, 40mm Oyster', qty: 1, price: 18 }], chat: [] },
  // E18 — approvals queue (pending) + approved picks
  { id: 'pr-04', number: 'PR-0044', jobId: 'j-30', status: 'pending', partId: 'pt-26', qty: 1, note: 'Insert chipped at 12', searchTerms: ['black/blue gmt insert'], requestedBy: 'Rosa', requestedAt: daysAgo(0, 8), station: 'Bench 3', source: 'wm', chat: [] },
  { id: 'pr-05', number: 'PR-0045', jobId: 'j-06', status: 'pending', partId: 'pt-27', qty: 1, searchTerms: ['pepsi insert'], requestedBy: 'MM', requestedAt: daysAgo(0, 8), station: 'Bench 1', source: 'wm', chat: [] },
  { id: 'pr-06', number: 'PR-0046', jobId: 'j-31', status: 'pending', partId: 'pt-15', qty: 4, searchTerms: ['bracelet screw'], requestedBy: 'Walter', requestedAt: daysAgo(0, 7), station: 'Refinishing', source: 'wm', chat: [] },
  { id: 'pr-07', number: 'PR-0047', jobId: 'j-24', status: 'pending', partId: 'pt-31', qty: 1, note: 'Balance staff bent', searchTerms: ['balance complete'], requestedBy: 'Rosa', requestedAt: daysAgo(0, 7), station: 'Bench 3', source: 'wm', chat: [] },
  { id: 'pr-08', number: 'PR-0048', jobId: 'j-03', status: 'pending', partId: 'pt-12', qty: 1, searchTerms: ['crystal gasket'], requestedBy: 'MM', requestedAt: daysAgo(0, 6), station: 'Bench 1', source: 'wm', chat: [] },
  { id: 'pr-09', number: 'PR-0049', jobId: 'j-32', status: 'pending', qty: 1, items: [{ description: 'Caseback sticker set (free-typed)', qty: 1 }], searchTerms: ['caseback sticker'], requestedBy: 'Walter', requestedAt: daysAgo(0, 6), station: 'Refinishing', source: 'pad', chat: [] },
  { id: 'pr-10', number: 'PR-0050', jobId: 'j-01', status: 'approved', partId: 'pt-11', qty: 1, searchTerms: ['gasket'], requestedBy: 'MM', requestedAt: daysAgo(0, 7), station: 'Bench 1', decidedBy: 'MM', decidedAt: daysAgo(0, 8), source: 'wm', chat: [] },
  { id: 'pr-11', number: 'PR-0051', jobId: 'j-04', status: 'approved', partId: 'pt-17', qty: 1, searchTerms: ['bezel insert'], requestedBy: 'MM', requestedAt: daysAgo(0, 7), station: 'Bench 2', decidedBy: 'MM', decidedAt: daysAgo(0, 8), source: 'wm', chat: [] },
  { id: 'pr-12', number: 'PR-0052', jobId: 'j-24', status: 'approved', partId: 'pt-06', qty: 1, searchTerms: ['barrel'], requestedBy: 'Rosa', requestedAt: daysAgo(0, 8), station: 'Bench 3', decidedBy: 'MM', decidedAt: daysAgo(0, 9), source: 'wm', chat: [] },
  { id: 'pr-13', number: 'PR-0053', jobId: 'j-30', status: 'approved', partId: 'pt-16', qty: 2, searchTerms: ['spring bar'], requestedBy: 'Rosa', requestedAt: daysAgo(0, 8), station: 'Bench 3', decidedBy: 'MM', decidedAt: daysAgo(0, 9), source: 'wm', chat: [] },
];

export const partsKnowledge: PartsKnowledgeEntry[] = [
  { id: 'pk-01', kind: 'association_confirmed', partId: 'pt-08', partNumber: '3285-310', reference: '126710', requestId: 'pr-01', detail: 'Approved on PR-0041 — 3285-310 confirmed for ref 126710', at: daysAgo(6, 11), by: 'Walter', station: 'Front Desk 1' },
  { id: 'pk-02', kind: 'alias_added', partId: 'pt-08', partNumber: '3285-310', alias: 'barrel for the gmt', requestId: 'pr-01', detail: 'Search term "barrel for the gmt" now maps to 3285-310', at: daysAgo(6, 11), by: 'Walter', station: 'Front Desk 1' },
  { id: 'pk-03', kind: 'rejected', partId: 'pt-17', partNumber: '315-24280', reference: '16613', requestId: 'pr-04', detail: 'Rejected on PR-0044 — black insert not the spec for 16613 (client wants blue)', at: daysAgo(3, 15), by: 'MM', station: 'Bench 1' },
];
