import type { Division, KioskService } from '../types';

// Public walk-in kiosk — mirrors the legacy kiosk's five optional service toggles
export const KIOSK_SERVICES: { key: KioskService; label: string; blurb: string }[] = [
  { key: 'mov_service', label: 'Movement Service', blurb: 'Full service of the movement' },
  { key: 'case_work', label: 'Case Work', blurb: 'Case refinishing or repair' },
  { key: 'band_repair', label: 'Band Repair', blurb: 'Bracelet or strap repair' },
  { key: 'band_polish', label: 'Band Polish', blurb: 'Bracelet refinishing' },
  { key: 'recut_bezel', label: 'Recut Bezel', blurb: 'Bezel recut and refinish' },
];

export const KIOSK_BRANDS: { division: Division; name: string; tagline: string }[] = [
  { division: 'rolliworks', name: 'Rolliworks', tagline: 'Service center' },
  { division: 'rollishop', name: 'RolliShop', tagline: 'Boutique' },
];
