declare module '@env' {
  export const NOTION_API_KEY: string;
  export const NOTION_SUPPLEMENTS_DB_ID: string;
  export const NOTION_PHASES_PAGE_ID: string;
  /** Opcional: analítica y error tracking (si falta, PostHog queda desactivado) */
  export const POSTHOG_API_KEY: string;
  /** Ej. https://us.i.posthog.com */
  export const POSTHOG_HOST: string;
}
