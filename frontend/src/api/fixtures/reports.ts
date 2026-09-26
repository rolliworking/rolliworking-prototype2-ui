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
  // Pad v2 — approved condition reports on room jobs so the supervisor detail sheet is inhabited
  { id: 'rep-03', token: 'IR-E02016-V1', version: 1, jobId: 'j-06', watchId: 'w-09', clientId: 'c-09', estimateId: 'e-09', status: 'approved',
    grades: [{ component: 'Case', grade: 'fair', note: 'lug scratches, light' }, { component: 'Crystal', grade: 'worn', note: 'chip at 4 o’clock edge — retaining ring loose' }, { component: 'Dial & hands', grade: 'good', note: 'tritium patina, keep' }, { component: 'Movement', grade: 'worn', note: 'mainspring set, amplitude 190°' }, { component: 'Crown & tube', grade: 'good' }, { component: 'Gaskets', grade: 'replace' }, { component: 'Bracelet', grade: 'fair', note: 'stretch 2mm' }, { component: 'Clasp', grade: 'good' }],
    notes: 'Full service with crystal ring re-seat. Client wants the tritium dial untouched.', photoIds: [], issuedAt: daysAgo(6, 10), issuedBy: 'MH', station: 'Inspection Bench', decidedAt: daysAgo(5, 12), decidedVia: 'portal' },
  { id: 'rep-04', token: 'IR-E02031-V1', version: 1, jobId: 'j-30', watchId: 'w-20', clientId: 'c-10', status: 'approved',
    grades: [{ component: 'Case', grade: 'worn', note: 'deep scratch caseback edge' }, { component: 'Crystal', grade: 'worn', note: 'scratched — replace' }, { component: 'Dial & hands', grade: 'good' }, { component: 'Movement', grade: 'fair', note: 'service due by interval' }, { component: 'Crown & tube', grade: 'good' }, { component: 'Gaskets', grade: 'replace' }, { component: 'Bracelet', grade: 'fair', note: 'refinish + tighten' }, { component: 'Clasp', grade: 'fair' }],
    notes: 'Three-way split: head to bench, case to refinishing, bracelet queued.', photoIds: [], issuedAt: daysAgo(4, 9), issuedBy: 'Walter', station: 'Inspection Bench', decidedAt: daysAgo(3, 10), decidedVia: 'staff' },
  { id: 'rep-05', token: 'IR-E02014-V1', version: 1, jobId: 'j-04', watchId: 'w-06', clientId: 'c-06', estimateId: 'e-06', status: 'approved',
    grades: [{ component: 'Case', grade: 'good' }, { component: 'Crystal', grade: 'good' }, { component: 'Dial & hands', grade: 'worn', note: 'lume failing on hour hand — relume approved' }, { component: 'Movement', grade: 'replace', note: 'barrel bridge wear' }, { component: 'Crown & tube', grade: 'fair' }, { component: 'Gaskets', grade: 'replace', note: 'crystal gasket' }, { component: 'Bracelet', grade: 'good' }, { component: 'Clasp', grade: 'good' }],
    notes: 'Relume hands + crystal gasket per client.', photoIds: [], issuedAt: daysAgo(20, 11), issuedBy: 'MH', station: 'Inspection Bench', decidedAt: daysAgo(19, 9), decidedVia: 'portal' },
];
