import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { HitListItem } from '@/api/client';

export function useHitList() {
  const [items, setItems] = useState<HitListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHitList().then((rows) => {
      setItems(rows);
      setLoading(false);
    });
  }, []);

  const toggle = useCallback(async (id: string) => {
    let next = false;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        next = !i.done;
        return { ...i, done: next };
      }),
    );
    await api.setHitListItemDone(id, next);
  }, []);

  return { items, loading, toggle };
}
