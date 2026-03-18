import React, { createContext, useContext } from 'react';

export type User = 'diana' | 'estefania';

export const UserContext = createContext<{ user: User; setUser: (u: User) => void }>({
  user: 'diana',
  setUser: () => {},
});

export function useUser() {
  return useContext(UserContext);
}
