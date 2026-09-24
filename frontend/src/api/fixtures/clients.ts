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
  ['c-25', 'Sebastian', 'Vidal', 'sebastian.vidal@example.com', '(786) 555-0125', 'Coral Gables', 'FL', 'Vidal Jewelers'],
];

const tradeIds = new Set(['c-11', 'c-25']);

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
  since: daysAgo(120 + i * 37),
}));
