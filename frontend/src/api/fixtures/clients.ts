import type { Client } from '../types';
import { daysAgo } from './time';

type Row = [string, string, string, string, string, string, string, string?];

const rows: Row[] = [
  ['c-01', 'Harrison', 'Whitfield', 'harrison.whitfield@example.com', '(212) 555-0101', 'New York', 'NY'],
  ['c-02', 'Eleanor', 'Vance', 'eleanor.vance@example.com', '(917) 555-0102', 'Brooklyn', 'NY'],
  ['c-03', 'Marcus', 'Delacroix', 'marcus.delacroix@example.com', '(203) 555-0103', 'Greenwich', 'CT'],
  ['c-04', 'Priya', 'Raghunathan', 'priya.raghunathan@example.com', '(201) 555-0104', 'Hoboken', 'NJ'],
  ['c-05', 'Jonathan', 'Okafor', 'j.okafor@example.com', '(646) 555-0105', 'New York', 'NY'],
  ['c-06', 'Sophie', 'Lindqvist', 'sophie.lindqvist@example.com', '(914) 555-0106', 'Scarsdale', 'NY'],
  ['c-07', 'Daniel', 'Moreau', 'daniel.moreau@example.com', '(305) 555-0107', 'Miami', 'FL'],
  ['c-08', 'Isabella', 'Ferrante', 'isabella.ferrante@example.com', '(617) 555-0108', 'Boston', 'MA'],
  ['c-09', 'Thomas', 'Abernathy', 't.abernathy@example.com', '(312) 555-0109', 'Chicago', 'IL'],
  ['c-10', 'Naomi', 'Castellanos', 'naomi.castellanos@example.com', '(213) 555-0110', 'Los Angeles', 'CA'],
  ['c-11', 'Benjamin', 'Hartwell', 'ben.hartwell@example.com', '(415) 555-0111', 'San Francisco', 'CA', 'Hartwell & Co.'],
  ['c-12', 'Camille', 'Beaumont', 'camille.beaumont@example.com', '(202) 555-0112', 'Washington', 'DC'],
  ['c-13', 'Richard', 'Stavros', 'richard.stavros@example.com', '(516) 555-0113', 'Garden City', 'NY'],
  ['c-14', 'Grace', 'Nakamura', 'grace.nakamura@example.com', '(206) 555-0114', 'Seattle', 'WA'],
  ['c-15', 'Oliver', 'Pemberton', 'oliver.pemberton@example.com', '(713) 555-0115', 'Houston', 'TX'],
  ['c-16', 'Adrienne', 'Kowalski', 'adrienne.k@example.com', '(267) 555-0116', 'Philadelphia', 'PA'],
  ['c-17', 'Samuel', 'Adeyemi', 'samuel.adeyemi@example.com', '(404) 555-0117', 'Atlanta', 'GA'],
  ['c-18', 'Victoria', 'Rosenthal', 'victoria.rosenthal@example.com', '(561) 555-0118', 'Palm Beach', 'FL'],
  ['c-19', 'Lucas', 'Bergström', 'lucas.bergstrom@example.com', '(303) 555-0119', 'Denver', 'CO'],
  ['c-20', 'Hannah', 'Petrakis', 'hannah.petrakis@example.com', '(602) 555-0120', 'Scottsdale', 'AZ'],
  ['c-21', 'Nathaniel', 'Crowe', 'nate.crowe@example.com', '(508) 555-0121', 'Nantucket', 'MA', 'Crowe Estates'],
  ['c-22', 'Mei-Ling', 'Tsai', 'meiling.tsai@example.com', '(408) 555-0122', 'San Jose', 'CA'],
  ['c-23', 'Julian', 'Ashworth', 'julian.ashworth@example.com', '(615) 555-0123', 'Nashville', 'TN'],
  ['c-24', 'Rebecca', 'Halloran', 'rebecca.halloran@example.com', '(401) 555-0124', 'Newport', 'RI'],
  ['c-30', 'Robert', 'Calloway', 'robert.calloway@example.com', '(203) 555-0130', 'Greenwich', 'CT', undefined],
  ['c-25', 'Sebastian', 'Vidal', 'sebastian.vidal@example.com', '(786) 555-0125', 'Coral Gables', 'FL', 'Vidal Jewelers'],
  ['c-31', 'RolliShop', '(internal)', 'rollishop@rollisuite.internal', '(212) 555-0131', 'New York', 'NY', 'RolliShop'],
  // Two different customers, same name — the real-world mixup case; contact info is what tells them apart
  ['c-32', 'William', 'Sanchez', 'wsanchez.nyc@example.com', '(212) 555-0132', 'New York', 'NY'],
  ['c-33', 'William', 'Sanchez', 'will.sanchez.tx@example.com', '(713) 555-0133', 'Houston', 'TX'],
  // Second same-name pair — only ONE has a watch in-house right now (search highlight scenario)
  ['c-34', 'Daniel', 'Okafor', 'd.okafor@example.com', '(312) 555-0134', 'Chicago', 'IL'],
  ['c-35', 'Daniel', 'Okafor', 'daniel.okafor.mia@example.com', '(305) 555-0135', 'Miami', 'FL'],
  ['c-36', 'Helena', 'Marsh', 'helena.marsh@example.com', '(212) 555-0136', 'New York', 'NY'],
  ['c-37', 'Victor', 'Adeyemi', 'victor.adeyemi@example.com', '(917) 555-0137', 'Brooklyn', 'NY'],
  // JV bin seeds (band / polish room tickets)
  ['c-38', 'Oliver', 'Brandt', 'oliver.brandt@example.com', '(212) 555-0138', 'New York', 'NY'],
  ['c-39', 'Amara', 'Osei', 'amara.osei@example.com', '(718) 555-0139', 'Queens', 'NY'],
  ['c-40', 'Lucas', 'Ferreira', 'lucas.ferreira@example.com', '(201) 555-0140', 'Jersey City', 'NJ'],
  ['c-41', 'Ingrid', 'Solberg', 'ingrid.solberg@example.com', '(203) 555-0141', 'Stamford', 'CT'],
  ['c-42', 'Mateo', 'Quintana', 'mateo.quintana@example.com', '(917) 555-0142', 'Bronx', 'NY'],
  ['c-43', 'Yuki', 'Tanaka', 'yuki.tanaka@example.com', '(646) 555-0143', 'New York', 'NY'],
  ['c-44', 'Samuel', 'Okonkwo', 'samuel.okonkwo@example.com', '(914) 555-0144', 'White Plains', 'NY'],
  ['c-45', 'Chloé', 'Martin', 'chloe.martin@example.com', '(212) 555-0145', 'New York', 'NY'],
  ['c-46', 'Rafael', 'Mendes', 'rafael.mendes@example.com', '(516) 555-0146', 'Great Neck', 'NY'],
];

const tradeIds = new Set(['c-11', 'c-25', 'c-31']);
// Trade accounts: the account's division manager reviews finished trade work before it is invoiced (Walter for RolliShop)
const ACCOUNT_MANAGER: Record<string, string> = { 'c-31': 'Walter', 'c-25': 'MH', 'c-11': 'MH' };
// Auto-quote (MH 2026-10-02): Vidal + RolliShop are quoted from the rate card the moment every line resolves; Hartwell & Co. is priced by estimate
const AUTO_QUOTE = new Set(['c-25', 'c-31']);

export const clients: Client[] = rows.map(([id, firstName, lastName, email, phone, city, state, company], i) => ({
  id,
  firstName,
  lastName,
  email,
  phone,
  city,
  state,
  company,
  street: `${120 + i * 37} ${['Park Ave', 'Madison Ave', 'Elm St', 'Harbor Rd', 'Lakeview Dr', 'Oak Ln', 'Ocean Blvd'][i % 7]}`,
  type: tradeIds.has(id) ? 'trade' : 'retail',
  autoQuote: tradeIds.has(id) ? AUTO_QUOTE.has(id) : undefined,
  managerShort: ACCOUNT_MANAGER[id],
  internal: id === 'c-31' ? true : undefined,
  since: daysAgo(120 + i * 37),
}));

// Authorized pickup persons (MH 2026-10-03) — people the account holder lets collect; checked at Pickup Station step 3. Samuel Adeyemi (c-17, SO-26-0115) lists his spouse.
clients.find((c) => c.id === 'c-17')!.authorizedPickups = [{ id: 'ap-c17-1', name: 'Folake Adeyemi', relation: 'spouse', phone: '(404) 555-0171', addedAt: daysAgo(40), addedBy: 'Vienna', via: 'staff' }];
