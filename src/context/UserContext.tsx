import React, { createContext, useContext } from 'react';

export type User = 'diana' | 'estefania';

export const UserContext = createContext<{
  user: User;
  setUser: (u: User) => void;
  clearStoredUserAndShowPicker: () => void;
}>({
  user: 'diana',
  setUser: () => {},
  clearStoredUserAndShowPicker: () => {},
});

export function useUser() {
  return useContext(UserContext);
}
