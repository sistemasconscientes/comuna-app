import { useEffect, useState } from 'react';
import { getUiPrefs, subscribeUiPrefs, type UiPrefs } from '../config/uiPrefs';

/** Preferencias de interfaz con re-render al cambiarlas desde Perfil. */
export function useUiPrefs(): UiPrefs {
  const [value, setValue] = useState(getUiPrefs);
  useEffect(() => {
    setValue(getUiPrefs());
    return subscribeUiPrefs(() => setValue(getUiPrefs()));
  }, []);
  return value;
}
