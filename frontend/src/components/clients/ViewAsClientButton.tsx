import { Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';

// Opens the client's RolliConnect exactly as they see it (amber banner, exit back here). Read-only impersonation, audited.
export const ViewAsClientButton = ({ clientId, testId = 'view-as-client' }: { clientId: string; testId?: string }) => {
  const nav = useNavigate(); const { pathname } = useLocation();
  return <button type="button" data-testid={testId} onClick={() => void api.startViewAsClient(clientId, pathname).then((to) => nav(to))} className="inline-flex items-center gap-1 rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"><Eye size={11} /> View as client</button>;
};
