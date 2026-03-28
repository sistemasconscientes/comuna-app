import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'preview' | 'production';

export function getAppEnvironment(): AppEnvironment {
  if (__DEV__) return 'development';
  const raw = (process.env.EXPO_PUBLIC_APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'preview') return 'preview';
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'development' || raw === 'dev') return 'development';
  return 'production';
}

/** Release para correlacionar issues con versión semver de la app (expo config). */
export function getSentryRelease(): string | undefined {
  const slug = Constants.expoConfig?.slug ?? 'comuna-app';
  const ver = Constants.expoConfig?.version;
  if (!ver) return undefined;
  return `${slug}@${ver}`;
}

/** Build nativo (iOS buildNumber / Android versionCode). */
export function getSentryDist(): string | undefined {
  const ios = Constants.expoConfig?.ios?.buildNumber;
  const android = Constants.expoConfig?.android?.versionCode;
  if (ios != null && String(ios).length > 0) return String(ios);
  if (android != null) return String(android);
  return undefined;
}

export type ReportErrorContext = {
  domain: string;
  user?: string;
} & Record<string, string | number | boolean | undefined | null>;

/**
 * Reporta fallos operativos a Sentry. No-op si el cliente no está inicializado (sin DSN).
 */
export function reportErrorToSentry(error: unknown, context: ReportErrorContext): void {
  if (!Sentry.getClient()) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const { domain, user, ...rest } = context;

  Sentry.captureException(err, (scope) => {
    scope.setTag('domain', domain);
    scope.setTag('app_environment', getAppEnvironment());
    if (user) scope.setUser({ id: user });
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined && value !== null) {
        scope.setExtra(key, value);
      }
    }
    return scope;
  });
}
