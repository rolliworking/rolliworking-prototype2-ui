import { createContext, useContext } from 'react';
import { fmtMoney } from '@/lib/format';

// Money scope: RolliWorking (/rw) sets this per ROLE — watchmakers never see dollar figures (counts + job numbers only); supervisors and managers keep totals
export const MoneyContext = createContext(true);
export const useShowMoney = () => useContext(MoneyContext);
export const useFmtMoney = () => { const show = useShowMoney(); return (n: number) => (show ? fmtMoney(n) : '—'); };
