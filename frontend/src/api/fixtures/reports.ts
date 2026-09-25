import type { InspectionReportDoc } from '../types';
import { daysAgo } from './time';

export const REPORT_COMPONENTS = ['Case', 'Crystal', 'Dial & hands', 'Movement', 'Crown & tube', 'Gaskets', 'Bracelet', 'Clasp'];

// Eleanor · Daytona · job j-11 (awaiting customer approval) — v2 supersedes v1
export const inspectionReports: InspectionReportDoc[] = [
  { id: 'rep-01', token: 'IR-ELEANOR-V1', version: 1, jobId: 'j-11', watchId: 'w-02', clientId: 'c-02', estimateId: 'e-02', status: 'superseded', supersededById: 'rep-02',
    grades: [{ component: 'Case', grade: 'fair', note: 'light scratches' }, { component: 'Crystal', grade: 'good' }, { component: 'Dial & hands', grade: 'good' }, { component: 'Movement', grade: 'worn', note: 'amplitude low' }, { component: 'Crown & tube', grade: 'good' }, { component: 'Gaskets', grade: 'replace' }, { component: 'Bracelet', grade: 'good' }, { component: 'Clasp', grade: 'good' }],
    notes: 'Initial inspection.', photoIds: [], issuedAt: daysAgo(6, 11), issuedBy: 'Walter', station: 'Inspection Bench' },
  { id: 'rep-02', token: 'IR-ELEANOR-V2', version: 2, jobId: 'j-11', watchId: 'w-02', clientId: 'c-02', estimateId: 'e-02', status: 'issued', supersedes: 'rep-01',
    grades: [{ component: 'Case', grade: 'fair', note: 'bezel scratch at 10 o’clock (your photo) — P line added' }, { component: 'Crystal', grade: 'good' }, { component: 'Dial & hands', grade: 'good' }, { component: 'Movement', grade: 'worn', note: 'amplitude low, service due' }, { component: 'Crown & tube', grade: 'good' }, { component: 'Gaskets', grade: 'replace' }, { component: 'Bracelet', grade: 'good' }, { component: 'Clasp', grade: 'fair', note: 'spring bar wear' }],
    notes: 'Revised after your bezel photo: the scratch needs a refinish line, reflected in estimate E01042 rev 2. Everything else as first reported.', photoIds: [], issuedAt: daysAgo(2, 16), issuedBy: 'Walter', station: 'Inspection Bench', emailId: 'ob-rep-02' },
];
