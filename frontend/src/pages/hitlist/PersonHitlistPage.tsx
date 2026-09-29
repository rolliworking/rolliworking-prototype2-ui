import { Navigate, useParams } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import TodayPage, { useHitlistBase } from '@/pages/TodayPage';

// /hitlist/:slug — a stable, bookmarkable URL per staff member
export default function PersonHitlistPage() {
  const { slug = '' } = useParams(); const { base } = useHitlistBase(); const { user } = useAuth();
  const u = hl.userBySlug(slug);
  if (u && user && !hl.canViewHitlist(user, u)) return <Navigate to={`${base}/${hl.slugOf(user)}`} replace />;
  if (!u) return <div data-testid="hitlist-unknown" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">No staff member at “{slug}”. <a href={`${base}/${hl.slugOf(user!)}`} className="underline">Open your own Hitlist</a></div>;
  return <TodayPage key={u.id} forUser={u} />;
}

// /hitlist and /today → your own list (or the team rollup when that is your home screen)
export function HitlistIndex() {
  const { user } = useAuth(); const { base } = useHitlistBase();
  const home = hl.getHomeScreen(user!.id);
  const to = home === 'team' && hl.isSupervisor(user) ? `${base}/${hl.slugOf(user!)}/team` : `${base}/${hl.slugOf(user!)}`;
  return <Navigate to={to} replace />;
}

// Sign-in landing — honours the per-device / per-user home-screen preference
export function HomeRedirect() {
  const { user } = useAuth();
  const to = hl.homeRouteFor(user!);
  return <Navigate to={to} replace />;
}
