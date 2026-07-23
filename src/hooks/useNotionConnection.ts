import React from 'react';
import { usePostHog } from 'posthog-react-native';
import {
  NotionApiError,
  discoverNotionTemplate,
  getNotionTokenInfo,
  verifyManualNotionIds,
} from '../api/notion';
import { enableDemoMode, saveNotionSettings } from '../config/notionSettings';
import { DEMO_PROFILE_LABELS } from '../api/notionDemo';
import { overridesFromPhaseRowLabels, saveProfileOverrides } from '../config/profiles';
import { reportErrorToSentry } from '../utils/observability';

export type NotionConnectStep = 'idle' | 'checking_token' | 'discovering' | 'saving';

export interface ManualNotionIds {
  supplementsDbId: string;
  phasesPageId: string;
  mealPrepHubPageId?: string;
  teasDbId?: string;
}

function connectErrorMessage(e: unknown): string {
  if (e instanceof NotionApiError) {
    if (e.status === 401) return 'Token inválido. Copia el token completo de tu integración.';
    if (e.status === 404 || e.status === 403) {
      return 'Notion no encuentra esas páginas con este token. Comparte el template con tu integración e inténtalo de nuevo.';
    }
    return `Notion respondió ${e.status}. Inténtalo de nuevo en un momento.`;
  }
  return e instanceof Error ? e.message : 'No se pudo conectar con Notion.';
}

/**
 * Conexión del workspace de Notion en runtime (onboarding y reconexión):
 * valida token, descubre el template (o verifica IDs manuales), persiste
 * settings y mapea perfiles según la tabla de fases.
 */
export function useNotionConnection(onConnected: () => void) {
  const posthog = usePostHog();
  const [step, setStep] = React.useState<NotionConnectStep>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finishWith = React.useCallback(
    async (
      token: string,
      ids: Required<ManualNotionIds>,
      phaseRowLabels: string[],
      mode: 'auto' | 'manual',
    ) => {
      setStep('saving');
      await saveNotionSettings({ apiKey: token, ...ids });
      if (phaseRowLabels.length) {
        await saveProfileOverrides(overridesFromPhaseRowLabels(phaseRowLabels));
      }
      posthog?.capture('notion_connected', { mode, profiles_detected: phaseRowLabels.length });
      onConnected();
    },
    [onConnected, posthog],
  );

  const runConnect = React.useCallback(
    (mode: 'auto' | 'manual', task: (token: string) => Promise<void>, token: string) => {
      setError(null);
      void (async () => {
        try {
          setStep('checking_token');
          await getNotionTokenInfo(token.trim());
          await task(token.trim());
        } catch (e) {
          reportErrorToSentry(e, { domain: 'notion_onboarding', mode });
          posthog?.capture('notion_connect_failed', { mode });
          if (!mountedRef.current) return;
          setError(connectErrorMessage(e));
        } finally {
          if (mountedRef.current) setStep('idle');
        }
      })();
    },
    [posthog],
  );

  /** Detecta el template automáticamente vía la search API. */
  const connectAuto = React.useCallback(
    (token: string) => {
      runConnect(
        'auto',
        async (t) => {
          setStep('discovering');
          const found = await discoverNotionTemplate(t);
          await finishWith(
            t,
            {
              supplementsDbId: found.supplementsDbId,
              phasesPageId: found.phasesPageId,
              mealPrepHubPageId: found.mealPrepHubPageId,
              teasDbId: found.teasDbId,
            },
            found.phaseRowLabels,
            'auto',
          );
        },
        token,
      );
    },
    [finishWith, runConnect],
  );

  /** IDs pegados a mano (fallback cuando la autodetección no encuentra el template). */
  const connectManual = React.useCallback(
    (token: string, ids: ManualNotionIds) => {
      runConnect(
        'manual',
        async (t) => {
          setStep('discovering');
          const { phaseRowLabels } = await verifyManualNotionIds(t, {
            supplementsDbId: ids.supplementsDbId.trim(),
            phasesPageId: ids.phasesPageId.trim(),
          });
          await finishWith(
            t,
            {
              supplementsDbId: ids.supplementsDbId.trim(),
              phasesPageId: ids.phasesPageId.trim(),
              mealPrepHubPageId: (ids.mealPrepHubPageId ?? '').trim(),
              teasDbId: (ids.teasDbId ?? '').trim(),
            },
            phaseRowLabels,
            'manual',
          );
        },
        token,
      );
    },
    [finishWith, runConnect],
  );

  /** Modo demo: datos de ejemplo locales, sin Notion (también para App Review). */
  const enterDemoMode = React.useCallback(() => {
    setError(null);
    void (async () => {
      try {
        await enableDemoMode();
        await saveProfileOverrides(overridesFromPhaseRowLabels([...DEMO_PROFILE_LABELS]));
        posthog?.capture('notion_demo_mode_entered');
        onConnected();
      } catch (e) {
        reportErrorToSentry(e, { domain: 'notion_onboarding', mode: 'demo' });
        if (mountedRef.current) setError('No se pudo activar el modo de ejemplo.');
      }
    })();
  }, [onConnected, posthog]);

  return { step, error, connectAuto, connectManual, enterDemoMode, busy: step !== 'idle' };
}
