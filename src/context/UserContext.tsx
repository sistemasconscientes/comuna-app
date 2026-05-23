import React, { createContext, useContext } from 'react';
import type { ProfileId } from '../config/profiles';

/** Perfil activo en la app (máx. 2 slots; ver `src/config/profiles.ts`). */
export type User = ProfileId;

export const UserContext = createContext<{
  user: User;
  setUser: (u: User) => void;
  clearStoredUserAndShowPicker: () => void;
}>({
  user: 'profile_1',
  setUser: () => {},
  clearStoredUserAndShowPicker: () => {},
});

export function useUser() {
  return useContext(UserContext);
}
