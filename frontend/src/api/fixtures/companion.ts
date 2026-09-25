import type { KnowledgeCard, ModelReference, PhotoLabel, PriceEvidence, RoutedQuestion, Task } from '../types';
import { daysAgo } from './time';

export const modelReferences: ModelReference[] = [
  { id: 'mr-01', brand: 'Rolex', model: 'Daytona', aliases: ['daytona', 'cosmograph'], yearFrom: 2000, yearTo: 2016, reference: '116520' },
  { id: 'mr-02', brand: 'Rolex', model: 'Daytona (ceramic)', aliases: ['ceramic daytona', 'daytona ceramic'], yearFrom: 2016, yearTo: 2026, reference: '116500LN' },
  { id: 'mr-03', brand: 'Rolex', model: 'Submariner', aliases: ['sub', 'submariner', 'submariner date'], yearFrom: 1988, yearTo: 2010, reference: '16610' },
  { id: 'mr-04', brand: 'Rolex', model: 'Submariner (ceramic)', aliases: ['ceramic sub', 'new sub'], yearFrom: 2010, yearTo: 2026, reference: '126610LN' },
  { id: 'mr-05', brand: 'Rolex', model: 'Datejust 36', aliases: ['datejust', 'dj', 'dj36'], yearFrom: 1988, yearTo: 2005, reference: '16234' },
  { id: 'mr-06', brand: 'Rolex', model: 'GMT-Master II', aliases: ['gmt', 'gmt master', 'pepsi', 'batman'], yearFrom: 2007, yearTo: 2026, reference: '116710LN' },
  { id: 'mr-07', brand: 'Rolex', model: 'Oyster Perpetual 41', aliases: ['op41', 'oyster perpetual', 'op'], yearFrom: 2020, yearTo: 2026, reference: '124300' },
  { id: 'mr-08', brand: 'Tudor', model: 'Black Bay 58', aliases: ['bb58', 'black bay', 'black bay 58'], yearFrom: 2018, yearTo: 2026, reference: 'M79030B-0001' },
];

// mined from past estimates/POs (fixture): how often a part was billed, average price, last used
export const priceEvidence: PriceEvidence[] = [
  { partId: 'pt-01', uses: 11, avg: 285, last: daysAgo(96, 10) },
  { partId: 'pt-02', uses: 3, avg: 310, last: daysAgo(210, 10) },
  { partId: 'pt-03', uses: 7, avg: 240, last: daysAgo(40, 10) },
  { partId: 'pt-04', uses: 14, avg: 95, last: daysAgo(12, 10) },
  { partId: 'pt-05', uses: 5, avg: 180, last: daysAgo(150, 10) },
  { partId: 'pt-06', uses: 22, avg: 28, last: daysAgo(3, 10) },
  { partId: 'pt-07', uses: 2, avg: 1450, last: daysAgo(300, 10) },
  { partId: 'pt-08', uses: 4, avg: 410, last: daysAgo(60, 10) },
  { partId: 'pt-09', uses: 6, avg: 120, last: daysAgo(25, 10) },
  { partId: 'pt-10', uses: 1, avg: 2900, last: daysAgo(400, 10) },
  { partId: 'pt-11', uses: 9, avg: 65, last: daysAgo(18, 10) },
  { partId: 'pt-12', uses: 8, avg: 140, last: daysAgo(33, 10) },
  { partId: 'pt-13', uses: 3, avg: 520, last: daysAgo(80, 10) },
];
// one verification older than 12 months → "re-verify pricing"
export const priceVerifications: Record<string, { at: string; by: string; station: string }> = {
  'pt-04': { at: daysAgo(20, 11), by: 'MM', station: 'Watchmaker Room' },
  'pt-02': { at: daysAgo(400, 11), by: 'MH', station: 'Inspection Bench' },
};

export const knowledgeCards: KnowledgeCard[] = [
  { id: 'kc-01', title: 'Magnetization — quick check & fix', body: 'Symptoms: sudden +30s/day or more, hairspring coils sticking. Check with the compass app or Lepsi; demagnetize on the bench unit (two passes), re-time on the RolliTime. If rate does not settle, book a full service — do not release.', tags: ['magnetized', 'magnetization', 'demag', 'running fast', 'timing'], at: daysAgo(120, 9), by: 'MM', station: 'Watchmaker Room' },
  { id: 'kc-02', title: 'Water resistance policy', body: 'Every case opened gets a pressure test before release; record the depth tested on the evidence slot. We test to the dial rating, never above. Gaskets are replaced on every service regardless of appearance. No WR guarantee on vintage (pre-1990) cases — tell the client at intake.', tags: ['water', 'water resistance', 'pressure', 'wr', 'gasket', 'swim'], at: daysAgo(200, 9), by: 'MH', station: 'Inspection Bench' },
  { id: 'kc-03', title: 'Turnaround norms', body: 'Full service 6–8 weeks · band/polish only 1–2 weeks · small job same-week · warranty returns jump the bench queue. Quote +2 weeks if parts must come from RSC. Never promise a date without checking the Supervisor board.', tags: ['turnaround', 'how long', 'eta', 'weeks', 'lead time', 'when ready'], at: daysAgo(90, 9), by: 'MH', station: 'Front Desk 1' },
  { id: 'kc-04', title: 'Polishing & refinishing — what we tell clients', body: 'We refinish to factory grain (brushed/polished boundaries kept sharp). We decline to polish collectible or vintage cases unless the client insists in writing — note it on the estimate. Light polish is included in a full service; heavy refinish is a P line.', tags: ['polish', 'refinish', 'polishing', 'brushed', 'scratches'], at: daysAgo(150, 9), by: 'Walter', station: 'Front Desk 1' },
  { id: 'kc-05', title: 'Bracelet stretch & pin replacement', body: 'Stretch on Oyster/Jubilee is normal wear; we replace pins and tubes, never re-plate. Quote a B line for pins; if links are elongated recommend a new bracelet through RSC (lead time 3–6 weeks).', tags: ['bracelet', 'stretch', 'pins', 'links', 'jubilee', 'oyster'], at: daysAgo(60, 9), by: 'MM', station: 'Watchmaker Room' },
  { id: 'kc-06', title: 'Warranty terms', body: '24 months on movement work from the date of release; 12 months on WR (excluding crown/gasket abuse). Warranty jobs are kind = warranty, owner concierge, no charge lines. Polish and bracelet work carry no warranty.', tags: ['warranty', 'guarantee', 'covered', '24 months'], at: daysAgo(30, 9), by: 'MH', station: 'Front Desk 1' },
];

export const routedQuestions: RoutedQuestion[] = [
  { id: 'rq-ask-01', question: 'Do we service quartz Cellini movements or send them out?', taskId: 't-ask-01', status: 'open', division: 'rolliworks', at: daysAgo(1, 10), by: 'Vienna', station: 'Front Desk 1' },
];
export const routedTasks: Task[] = [
  { id: 't-ask-01', title: 'Answer shop question: Do we service quartz Cellini movements or send them out?', assignedTo: { type: 'role', role: 'manager' }, createdBy: 'Vienna', division: 'rolliworks', status: 'open', createdAt: daysAgo(1, 10), station: 'Front Desk 1', dueAt: daysAgo(-1, 17) },
];

export const LABEL_PILLS: { group: 'dial' | 'hands' | 'bracelet' | 'condition'; label: string; tags: string[] }[] = [
  { group: 'dial', label: 'Dial', tags: ['dial: original', 'dial: refinished', 'dial: service replacement'] },
  { group: 'hands', label: 'Hands', tags: ['hands: correct', 'hands: incorrect', 'hands: relumed'] },
  { group: 'bracelet', label: 'Bracelet', tags: ['bracelet: stamping OK', 'bracelet: stamping worn', 'bracelet: non-original'] },
  { group: 'condition', label: 'Condition', tags: ['unpolished', 'light polish', 'heavy polish', 'dent', 'scratches', 'corrosion', 'crystal chip'] },
];
export const photoLabels: PhotoLabel[] = [
  { id: 'pl-01', photoId: 'ev-01', jobId: 'j-08', watchId: 'w-10', source: 'evidence', tags: ['dial: original', 'hands: correct', 'light polish'], skipped: false, at: daysAgo(30, 15), by: 'MH', station: 'Inspection Bench' },
  { id: 'pl-02', photoId: 'ev-09', jobId: 'j-25', watchId: 'w-21', source: 'evidence', tags: ['dial: original', 'bracelet: stamping OK', 'unpolished'], skipped: false, at: daysAgo(400, 15), by: 'Walter', station: 'Front Desk 1' },
];
