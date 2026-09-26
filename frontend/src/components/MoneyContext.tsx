import { createContext, useContext } from 'react';

// Hide-money amber default: RolliWorking (/rw) sets this false so bench views never render dollar amounts
export const MoneyContext = createContext(true);
export const useShowMoney = () => useContext(MoneyContext);
