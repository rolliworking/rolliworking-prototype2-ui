import { IdentifierSearch } from '@/components/clients/IdentifierSearch';

// Top-bar search — any identifier resolves to the client's 360 page (or the record itself if no client is attached)
export const GlobalSearch = () => <IdentifierSearch className="relative w-[420px] shrink-0" testIdPrefix="global-search" placeholder="Search anything — name, phone, est #, SUB#, tracking, ref, serial…" />;
