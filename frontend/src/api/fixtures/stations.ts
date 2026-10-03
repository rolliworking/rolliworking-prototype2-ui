import type { Station } from '../types';

export const stations: Station[] = [
  { id: 'st-01', name: 'Front Desk 1',    division: 'rolliworks', receptionMode: true, pairedKioskId: 'st-kiosk-fd', clockPoint: true },
  { id: 'st-02', name: 'Front Desk 2',    division: 'rolliworks', receptionMode: true, pairedKioskId: 'st-kiosk-fd2' },
  { id: 'st-03', name: 'Inspection Bench',division: 'rolliworks' },
  { id: 'st-04', name: 'Watchmaker Room', division: 'rolliworks', clockPoint: true },
  { id: 'st-05', name: 'Shipping',        division: 'rolliworks' },
  { id: 'st-rs', name: 'RS Counter',      division: 'rollishop', clockPoint: true },
  // WM 1–8 are the bench iPads (device records, personal login for whichever watchmaker sits there) — NOT people
  ...Array.from({ length: 8 }, (_, i) => ({ id: `st-wm${i + 1}`, name: `WM ${i + 1}`, division: 'rolliworks' as const, deviceType: 'pad' as const })),
  { id: 'st-jv-pad', name: 'Workshop pad (JV)', division: 'rolliworks', deviceType: 'pad' },
  { id: 'st-kiosk-fd', name: 'Front-desk check-in kiosk', division: 'rolliworks', deviceType: 'kiosk' },
  { id: 'st-kiosk-fd2', name: 'Front Desk 2 confirm kiosk', division: 'rolliworks', deviceType: 'kiosk' },
  { id: 'st-kiosk-wm', name: 'WM room photo kiosk', division: 'rolliworks', deviceType: 'kiosk' },
  // Pickup Station cameras are ROLES, not people: the counter cam shoots item / QR / hand-back, the client cam records the 60 s hand-over strip
  { id: 'st-pu-cam', name: 'Pickup client camera', division: 'rolliworks', deviceType: 'kiosk', cameraRole: 'client' },
];

// The device this prototype runs on is mocked as already registered to this station.
export const PREREGISTERED_STATION_ID = 'st-01';
