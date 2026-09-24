import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Scrolls to and flashes the element carrying data-hit="<hitKey>" when the URL has ?hit=
export function useHitHighlight(ready: boolean) {
  const [params] = useSearchParams();
  const hit = params.get('hit');
  useEffect(() => {
    if (!ready || !hit || hit === 'top') return;
    const el = document.querySelector<HTMLElement>(`[data-hit="${hit}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('hit-flash');
    const t = setTimeout(() => el.classList.remove('hit-flash'), 2600);
    return () => clearTimeout(t);
  }, [ready, hit]);
  return hit;
}
