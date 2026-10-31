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

// ─── Consentimiento (guideline 5.1.1(ii)): la persona puede apagar diagnósticos ───

const DIAGNOSTICS_OPT_OUT_KEY = 'diagnostics_opt_out_v1';
let diagnosticsOptedOut = false;

export function isDiagnosticsOptedOut(): boolean {
  return diagnosticsOptedOut;
}

/** Hidrata la preferencia guardada; llamar una vez en el boot. */
export async function loadDiagnosticsPreference(): Promise<boolean> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  try {
    diagnosticsOptedOut = (await AsyncStorage.getItem(DIAGNOSTICS_OPT_OUT_KEY)) === 'true';
  } catch {
    diagnosticsOptedOut = false;
  }
  return diagnosticsOptedOut;
}

/** Apaga/enciende Sentry (vía `sentryBeforeSend`); PostHog lo apaga quien llama (`optOut`). */
export async function setDiagnosticsOptedOut(optedOut: boolean): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  diagnosticsOptedOut = optedOut;
  await AsyncStorage.setItem(DIAGNOSTICS_OPT_OUT_KEY, optedOut ? 'true' : 'false');
}

/** `beforeSend` de Sentry: descarta todo si la persona apagó los diagnósticos. */
export function sentryBeforeSend<T>(event: T): T | null {
  return diagnosticsOptedOut ? null : event;
}

export type ReportErrorContext = {
  domain: string;
  user?: string;
} & Record<string, string | number | boolean | undefined | null>;

/**
 * Reporta fallos operativos a Sentry. No-op si el cliente no está inicializado (sin DSN).
 */
export function reportErrorToSentry(error: unknown, context: ReportErrorContext): void {
  if (!Sentry.getClient() || diagnosticsOptedOut) return;
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
