import type { DeptCode, Estimate, EstimateLine } from '../types';
import { daysAgo } from './time';

const line = (description: string, unitPrice: number, dept: DeptCode, qty = 1): EstimateLine => ({ description, qty, unitPrice, dept });
const sum = (lines: EstimateLine[]) => lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);

const build = (e: Omit<Estimate, 'total'>): Estimate => ({ ...e, total: sum(e.lines) });

export const estimates: Estimate[] = [
  build({ id: 'e-01', number: 'EST-26-1041', clientId: 'c-01', watchId: 'w-01', department: 'watchmaking', status: 'approved', createdAt: daysAgo(11), sentAt: daysAgo(10),
    concerns: 'Losing about a minute a day; crown feels gritty when winding.',
    lines: [line('Complete service — cal. 3235', 1250, 'W'), line('Gasket set & crown tube', 85, 'W'), line('Pressure test 300m', 115, 'W')] }),
  build({ id: 'e-02', number: 'EST-26-1042', clientId: 'c-02', watchId: 'w-02', department: 'watchmaking', status: 'awaiting_approval', createdAt: daysAgo(4), sentAt: daysAgo(3),
    concerns: 'Chronograph seconds hand sticks at 20 seconds; crystal has a chip at 4 o’clock.',
    lines: [line('Complete service — cal. 4130', 1850, 'W'), line('Replace chronograph clutch wheel', 640, 'W'), line('Sapphire crystal (OEM)', 360, 'W')] }),
  build({ id: 'e-03', number: 'EST-26-1043', clientId: 'c-03', watchId: 'w-03', department: 'polish', status: 'approved', createdAt: daysAgo(19), sentAt: daysAgo(19),
    concerns: 'Desk scratches on the clasp and case sides — wants it looking new for an anniversary.',
    lines: [line('Case & bracelet refinish — Jubilee', 325, 'P'), line('Ultrasonic clean', 60, 'P')] }),
  build({ id: 'e-04', number: 'EST-26-1044', clientId: 'c-04', watchId: 'w-04', department: 'watchmaking', status: 'approved', createdAt: daysAgo(8), sentAt: daysAgo(8),
    concerns: 'Date wheel skips; day disc slightly misaligned.',
    lines: [line('Complete service — cal. 3255', 1350, 'W'), line('Replace date wheel', 185, 'W'), line('Pressure test 100m', 115, 'W')] }),
  build({ id: 'e-05', number: 'EST-26-1045', clientId: 'c-05', watchId: 'w-05', department: 'watchmaking', status: 'approved', createdAt: daysAgo(3), sentAt: daysAgo(2),
    concerns: 'Stopped running after a fall; no visible damage.',
    lines: [line('Complete service — cal. 3230', 1250, 'W'), line('Pressure test 100m', 115, 'W')] }),
  build({ id: 'e-06', number: 'EST-26-1046', clientId: 'c-06', watchId: 'w-06', department: 'watchmaking', status: 'approved', createdAt: daysAgo(30), sentAt: daysAgo(29),
    concerns: 'Power reserve is under a day; GMT hand stiff to set.',
    lines: [line('Complete service — cal. 3285', 1450, 'W'), line('Mainspring & barrel assembly', 415, 'W'), line('Pressure test 100m', 115, 'W')] }),
  build({ id: 'e-07', number: 'EST-26-1047', clientId: 'c-07', watchId: 'w-07', department: 'band', status: 'approved', createdAt: daysAgo(15), sentAt: daysAgo(15),
    concerns: 'Bracelet has stretch; clasp opens on its own.',
    lines: [line('Bracelet tighten & re-pin (Oyster)', 380, 'B'), line('Clasp spring replacement', 140, 'B'), line('Refinish clasp', 100, 'P')] }),
  build({ id: 'e-08', number: 'EST-26-1048', clientId: 'c-08', watchId: 'w-08', department: 'watchmaking', status: 'awaiting_approval', createdAt: daysAgo(3), sentAt: daysAgo(2),
    concerns: 'Bezel insert cracked; runs fast.',
    lines: [line('Complete service — cal. 3130', 1150, 'W'), line('Bezel insert (OEM ceramic)', 200, 'W'), line('Bracelet re-pin', 180, 'B')] }),
  build({ id: 'e-09', number: 'EST-26-1049', clientId: 'c-09', watchId: 'w-09', department: 'watchmaking', status: 'approved', createdAt: daysAgo(20), sentAt: daysAgo(20),
    concerns: 'Moisture under the crystal after a swim.',
    lines: [line('Complete service — cal. 3135', 1250, 'W'), line('Replace crystal & gasket', 240, 'W'), line('Pressure test 300m', 60, 'W')] }),
  build({ id: 'e-10', number: 'EST-26-1050', clientId: 'c-10', watchId: 'w-10', department: 'polish', status: 'declined', createdAt: daysAgo(2), sentAt: daysAgo(2),
    concerns: 'Light scratches on bracelet.',
    lines: [line('Case & bracelet refinish — Oyster', 340, 'P')] }),
  build({ id: 'e-11', number: 'EST-26-1051', clientId: 'c-13', watchId: 'w-13', department: 'watchmaking', status: 'approved', createdAt: daysAgo(2), sentAt: daysAgo(1),
    concerns: 'Bezel rotates both ways; bracelet links loose.',
    lines: [line('Complete service — cal. MT5612', 950, 'W'), line('Titanium bracelet re-pin', 200, 'B')] }),
  build({ id: 'e-12', number: 'EST-26-1052', clientId: 'c-14', watchId: 'w-14', department: 'band', status: 'awaiting_approval', createdAt: daysAgo(5), sentAt: daysAgo(5),
    concerns: 'End-links rattle; clasp scratched.',
    lines: [line('Replace bracelet end-links', 420, 'B'), line('Clasp adjustment & refinish', 360, 'P')] }),
  // Estimates with watches expected to arrive through Intake
  build({ id: 'e-13', number: 'EST-26-1053', clientId: 'c-10', watchId: 'w-10', department: 'polish', status: 'approved', createdAt: daysAgo(3), sentAt: daysAgo(3),
    concerns: 'Back for another refinish — scratches on clasp and bezel from desk wear.',
    lines: [line('Case & bracelet refinish — Oyster', 340, 'P')] }),
  build({ id: 'e-14', number: 'EST-26-1054', clientId: 'c-18', watchId: 'w-16', department: 'watchmaking', status: 'approved', createdAt: daysAgo(6), sentAt: daysAgo(5),
    concerns: 'Runs about 3 minutes slow per day; date doesn’t jump at midnight.',
    lines: [line('Complete service — cal. 2236', 1150, 'W'), line('Replace crystal (OEM)', 240, 'W')] }),
  build({ id: 'e-15', number: 'EST-26-1055', clientId: 'c-16', watchId: 'w-17', department: 'band', status: 'approved', createdAt: daysAgo(4), sentAt: daysAgo(4),
    concerns: 'Bracelet feels loose; clasp pops open under the cuff.',
    lines: [line('Bracelet stretch repair', 380, 'B'), line('Clasp refinish', 100, 'P')] }),
  build({ id: 'e-16', number: 'EST-26-1056', clientId: 'c-19', watchId: 'w-18', department: 'watchmaking', status: 'approved', createdAt: daysAgo(7), sentAt: daysAgo(6),
    concerns: 'Water intrusion suspected after a swim; fogging under the crystal in the morning.',
    lines: [line('Complete service — cal. 3235', 1250, 'W'), line('Pressure test 100m', 115, 'W'), line('Platinum bezel refinish', 650, 'PM')] }),
];
