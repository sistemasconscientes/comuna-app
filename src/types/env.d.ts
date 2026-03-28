/** Expo inyecta `EXPO_PUBLIC_*` en el bundle (`.env` local y `eas.json` / EAS env en build). */
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_BACKEND_URL?: string;
    /** En builds release: preview | production (típico vía eas.json). En Metro, `getAppEnvironment()` usa `__DEV__`. */
    EXPO_PUBLIC_APP_ENV?: string;
  }
}

declare module '@env' {
  export const NOTION_API_KEY: string;
  export const NOTION_SUPPLEMENTS_DB_ID: string;
  export const NOTION_PHASES_PAGE_ID: string;
  /**
   * Opcional. Si es `true`/`1`/`yes` (case-insensitive) y la app corre en `__DEV__`,
   * no se llama a `updatePhase` tras comparar HealthKit con Notion (evita pisar la tabla de fases en dispositivo de desarrollo).
   */
  export const NOTION_SKIP_PHASE_WRITE: string | undefined;
  /** Página hub con sección "Comidas Activas" (p. ej. Cocina y Comida) */
  export const NOTION_MEAL_PREP_HUB_PAGE_ID: string;
  /** Opcional: analítica y error tracking (si falta, PostHog queda desactivado) */
  export const POSTHOG_API_KEY: string;
  /** Ej. https://us.i.posthog.com */
  export const POSTHOG_HOST: string;
  /** Misma clave que API_KEY en el backend Render (stock compartido Ambas) */
  export const BACKEND_API_KEY: string;
  /** Opcional: Sentry React Native; si falta o está vacío, no se llama `Sentry.init` ni `Sentry.wrap` */
  export const SENTRY_DSN: string | undefined;
}
