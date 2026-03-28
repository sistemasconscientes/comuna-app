/** Tipos mínimos: `expo-constants` viene con el monorepo de Expo (sin dependencia directa obligatoria). */
declare module 'expo-constants' {
  const Constants: {
    expoConfig?: {
      slug?: string;
      version?: string;
      ios?: { buildNumber?: string };
      android?: { versionCode?: number };
    } | null;
  };
  export default Constants;
}
