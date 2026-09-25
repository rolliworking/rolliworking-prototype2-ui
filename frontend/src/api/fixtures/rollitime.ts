import type { CaliberTolerance, TimingTest } from '../types';
import { daysAgo } from './time';

export const TIMING_POSITIONS = ['DU', 'DD', 'CD', 'CL', 'CU', 'CR'] as const;
export const caliberTolerances: CaliberTolerance[] = [
  { caliber: '3135', label: 'Cal. 3135 / 31xx', refPrefixes: ['16610', '16613', '16234', '16200', '16220'], crit1MaxDelta: 25, crit2Min: -1, crit2Max: 10, beatMax: 0.8, ampMin: 200, ampMax: 280, reserveHours: 44, liftAngle: 52 },
  { caliber: '3235', label: 'Cal. 3235 / 3285 (Chronergy)', refPrefixes: ['126610', '126710', '124300', '278274', '126334'], crit1MaxDelta: 12, crit2Min: -2, crit2Max: 2, beatMax: 0.6, ampMin: 220, ampMax: 300, reserveHours: 70, liftAngle: 50 },
  { caliber: '4130', label: 'Cal. 4130 (Daytona)', refPrefixes: ['116500', '116520', '116505'], crit1MaxDelta: 15, crit2Min: -2, crit2Max: 2, beatMax: 0.6, ampMin: 210, ampMax: 290, reserveHours: 72, liftAngle: 50 },
  { caliber: 'MT5402', label: 'Tudor MT5402', refPrefixes: ['M7903', 'M7950'], crit1MaxDelta: 20, crit2Min: -2, crit2Max: 4, beatMax: 0.8, ampMin: 210, ampMax: 300, reserveHours: 70, liftAngle: 50 },
];
export const GENERIC_TOLERANCE: CaliberTolerance = { caliber: 'generic', label: 'Generic mechanical (provisional)', refPrefixes: [], crit1MaxDelta: 30, crit2Min: -5, crit2Max: 15, beatMax: 1.0, ampMin: 190, ampMax: 300, reserveHours: 40, liftAngle: 52 };

const R = (rate: number, beat: number, amp: number) => ({ rate, beat, amp });
export const timingTests: TimingTest[] = [
  { id: 'tt-01', jobId: 'j-16', watchId: 'w-16', jobNumber: 'E02026', caliber: '3135', readings: [{ position: 'DU', ...R(4, 0.3, 262) }, { position: 'DD', ...R(6, 0.4, 258) }, { position: 'CD', ...R(-12, 0.9, 231) }, { position: 'CL', ...R(-19, 1.1, 224) }, { position: 'CU', ...R(-8, 0.7, 236) }, { position: 'CR', ...R(-15, 1.0, 228) }], avgRate: -7.3, avgBeat: 0.73, avgAmp: 239.8, delta: 25, liftAngle: 52, powerReserve: 41,
    evaluation: { crit1: false, crit2: false, beat: false, amp: true, reserve: false, suggested: 'reject', flags: ['Δ 25 s/d ≥ 25', 'avg −7.3 s/d outside −1/+10', 'beat 1.1 ms > 0.8', 'reserve 41 h < 44'] }, verdict: 'reject', reason: 'Beat error high in vertical positions — re-adjust hairspring stud, recheck reserve', at: daysAgo(3, 15), by: 'MH', station: 'RolliTime bench' },
  { id: 'tt-02', jobId: 'j-08', watchId: 'w-10', jobNumber: 'E02018', caliber: '3235', readings: [{ position: 'DU', ...R(1, 0.1, 281) }, { position: 'DD', ...R(0, 0.1, 279) }, { position: 'CD', ...R(-1, 0.2, 262) }, { position: 'CL', ...R(-2, 0.2, 258) }, { position: 'CU', ...R(0, 0.1, 266) }, { position: 'CR', ...R(-1, 0.2, 260) }], avgRate: -0.5, avgBeat: 0.15, avgAmp: 267.7, delta: 3, liftAngle: 50, powerReserve: 71,
    evaluation: { crit1: true, crit2: true, beat: true, amp: true, reserve: true, suggested: 'pass', flags: [] }, verdict: 'pass', at: daysAgo(31, 14), by: 'MH', station: 'RolliTime bench' },
];
