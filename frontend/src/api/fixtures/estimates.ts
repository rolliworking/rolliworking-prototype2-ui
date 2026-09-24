import type { Estimate, EstimateLine } from '../types';
import { daysAgo } from './time';

const line = (description: string, unitPrice: number, qty = 1): EstimateLine => ({ description, qty, unitPrice });
const sum = (lines: EstimateLine[]) => lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);

const build = (e: Omit<Estimate, 'total'>): Estimate => ({ ...e, total: sum(e.lines) });

export const estimates: Estimate[] = [
  build({ id: 'e-01', number: 'EST-26-1041', clientId: 'c-01', watchId: 'w-01', department: 'watchmaking', status: 'approved', createdAt: daysAgo(11), sentAt: daysAgo(10),
    lines: [line('Complete service — cal. 3235', 1250), line('Gasket set & crown tube', 85), line('Pressure test 300m', 115)] }),
  build({ id: 'e-02', number: 'EST-26-1042', clientId: 'c-02', watchId: 'w-02', department: 'watchmaking', status: 'awaiting_approval', createdAt: daysAgo(4), sentAt: daysAgo(3),
    lines: [line('Complete service — cal. 4130', 1850), line('Replace chronograph clutch wheel', 640), line('Sapphire crystal (OEM)', 360)] }),
  build({ id: 'e-03', number: 'EST-26-1043', clientId: 'c-03', watchId: 'w-03', department: 'polish', status: 'approved', createdAt: daysAgo(19), sentAt: daysAgo(19),
    lines: [line('Case & bracelet refinish — Jubilee', 325), line('Ultrasonic clean', 60)] }),
  build({ id: 'e-04', number: 'EST-26-1044', clientId: 'c-04', watchId: 'w-04', department: 'watchmaking', status: 'approved', createdAt: daysAgo(8), sentAt: daysAgo(8),
    lines: [line('Complete service — cal. 3255', 1350), line('Replace date wheel', 185), line('Pressure test 100m', 115)] }),
  build({ id: 'e-05', number: 'EST-26-1045', clientId: 'c-05', watchId: 'w-05', department: 'watchmaking', status: 'draft', createdAt: daysAgo(1),
    lines: [line('Complete service — cal. 3230', 1250)] }),
  build({ id: 'e-06', number: 'EST-26-1046', clientId: 'c-06', watchId: 'w-06', department: 'watchmaking', status: 'approved', createdAt: daysAgo(30), sentAt: daysAgo(29),
    lines: [line('Complete service — cal. 3285', 1450), line('Mainspring & barrel assembly', 415), line('Pressure test 100m', 115)] }),
  build({ id: 'e-07', number: 'EST-26-1047', clientId: 'c-07', watchId: 'w-07', department: 'band', status: 'approved', createdAt: daysAgo(15), sentAt: daysAgo(15),
    lines: [line('Bracelet tighten & re-pin (Oyster)', 380), line('Clasp spring replacement', 140), line('Refinish clasp', 100)] }),
  build({ id: 'e-08', number: 'EST-26-1048', clientId: 'c-08', watchId: 'w-08', department: 'watchmaking', status: 'awaiting_approval', createdAt: daysAgo(3), sentAt: daysAgo(2),
    lines: [line('Complete service — cal. 3130', 1150), line('Bezel insert (OEM ceramic)', 200)] }),
  build({ id: 'e-09', number: 'EST-26-1049', clientId: 'c-09', watchId: 'w-09', department: 'watchmaking', status: 'approved', createdAt: daysAgo(20), sentAt: daysAgo(20),
    lines: [line('Complete service — cal. 3135', 1250), line('Replace crystal & gasket', 240), line('Pressure test 300m', 60)] }),
  build({ id: 'e-10', number: 'EST-26-1050', clientId: 'c-10', watchId: 'w-10', department: 'polish', status: 'declined', createdAt: daysAgo(2), sentAt: daysAgo(2),
    lines: [line('Case & bracelet refinish — Oyster', 340)] }),
  build({ id: 'e-11', number: 'EST-26-1051', clientId: 'c-13', watchId: 'w-13', department: 'watchmaking', status: 'sent', createdAt: daysAgo(2), sentAt: daysAgo(1),
    lines: [line('Complete service — cal. MT5612', 950), line('Titanium bracelet re-pin', 200)] }),
  build({ id: 'e-12', number: 'EST-26-1052', clientId: 'c-14', watchId: 'w-14', department: 'band', status: 'awaiting_approval', createdAt: daysAgo(5), sentAt: daysAgo(5),
    lines: [line('Replace bracelet end-links', 420), line('Clasp adjustment & refinish', 360)] }),
];
