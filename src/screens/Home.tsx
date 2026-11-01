import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHealthData } from '../hooks/useHealthData';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useTeas } from '../hooks/useTeas';
import TeaCard from '../components/TeaCard';
import EnergyCard from '../components/EnergyCard';
import { Ionicons } from '@expo/vector-icons';
import { useEnergy } from '../hooks/useEnergy';
import { useUiPrefs } from '../hooks/useUiPrefs';
import { DOSE_MOMENT_LABEL, currentMoment, groupByMoment } from '../utils/doseMoment';
import { useCalendarDayLocal } from '../hooks/useSelectableLogDate';
import { reportDailyLogProgress } from '../api/localNotifications';
import { getNotionSupplementPersona, getProfileLabel } from '../config/profiles';
import { useUser } from '../context/UserContext';
import type { Phase } from '../types';
import { cyclePhaseToPhase } from '../utils/phaseUtils';
import { ErrorBanner } from '../components/ErrorBanner';
import { LoadingRow } from '../components/LoadingRow';
import { EmptyState } from '../components/EmptyState';
import {
  FLOATING_TAB_BAR_EXTRA,
  SCREEN_PADDING_TOP_EXTRA,
  SCREEN_SCROLL_PADDING_BOTTOM_EXTRA,
} from '../constants/floatingTabBar';
import { theme } from '../theme/colors';

const DEFAULT_USER_EMOJI = '🌿';

const C = {
  bg: theme.bg,
  card: theme.card,
  accent: theme.accent,
  text: theme.text,
  muted: theme.textMuted,
  border: theme.border,
  pillBg: theme.pillBg,
  rowDivider: theme.rowDivider,
};

const PHASE_PILL_LABELS: Record<string, string> = {
  menstrual: 'Menstrual',
  folicular: 'Folicular',
  ovulacion: 'Ovulación',
  lutea: 'Lútea',
};

const PHASE_BAR_SHORT_LABELS: Record<Phase, string> = {
  menstrual: 'Mens.',
  folicular: 'Fol.',
  ovulatoria: 'Ovul.',
  lutea: 'Lútea',
};

const PHASE_CONFIG: Record<
  Phase,
  {
    emoji: string;
    message: string;
    fillPercent: number;
    color: string;
    fillColor: string;
  }
> = {
  menstrual: {
    emoji: '🌑',
    message: 'sangre que expulsa nuestros males',
    fillPercent: 10,
    color: '#E24B4A',
    fillColor: '#F09595',
  },
  folicular: {
    emoji: '🦖',
    message: 'lista para comerte el mundo',
    fillPercent: 40,
    color: '#D4537E',
    fillColor: '#F4C0D1',
  },
  ovulatoria: {
    emoji: '👩‍❤️‍💋👩',
    message: 'muévelo nena! 🍑',
    fillPercent: 64,
    color: '#BA7517',
    fillColor: '#FAC775',
  },
  lutea: {
    emoji: '🦥',
    message: 'vamo suave',
    fillPercent: 84,
    color: '#534AB7',
    fillColor: '#CECBF6',
  },
};

function formatTodayLongEs(): string {
  const raw = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type HomeProps = {
  /** Abre la pantalla Perfil / ajustes (no hay pestaña de Perfil en la barra). */
  onOpenSettings: () => void;
};

export default function Home({ onOpenSettings }: HomeProps) {
  const insets = useSafeAreaInsets();
  const calendarDayKey = useCalendarDayLocal();
  const { user } = useUser();
  const [userEmoji, setUserEmoji] = React.useState<string>(DEFAULT_USER_EMOJI);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(`user_emoji_${user}`);
        if (cancelled) return;
        setUserEmoji(raw || DEFAULT_USER_EMOJI);
      } catch {
        if (!cancelled) setUserEmoji(DEFAULT_USER_EMOJI);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const {
    cyclePhase,
    cycleDay,
    loading: healthLoading,
    error: healthError,
    tracksCycle,
    lastPeriodStart,
    cycleLengthDays,
    healthKitLifecycleContext,
  } = useHealthData(user, {
    calendarDayKey,
  });
  const {
    supplements,
    idByNotionId,
    loading: supplementsLoading,
    error: supplementsError,
  } = useSupplements(user, cyclePhase ?? '', { calendarDayKey });
  const {
    isTaken,
    markTaken,
    loading: logLoading,
    error: logError,
  } = useDailyLog(user, calendarDayKey);

  const dataLoading = healthLoading || supplementsLoading || logLoading;
  const fetchError = healthError ?? supplementsError ?? logError;

  const phaseLabel = cyclePhase ? PHASE_PILL_LABELS[cyclePhase] : '—';

  const currentPhase: Phase = cyclePhase ? cyclePhaseToPhase(cyclePhase) : 'menstrual';

  // Sin ciclo: tés en casa sin filtrar por fase.
  const { teas, currentIndex, nextTea } = useTeas(tracksCycle ? currentPhase : null);

  const config = PHASE_CONFIG[currentPhase];
  const trackPercent =
    cycleDay !== null ? Math.min(100, (cycleDay / cycleLengthDays) * 100) : config.fillPercent;

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  // Recordatorio nocturno: hoy completo ⇒ no suena; desmarcar lo rearma.
  React.useEffect(() => {
    if (dataLoading || fetchError) return;
    void reportDailyLogProgress(calendarDayKey, takenCount, supplements.length);
  }, [calendarDayKey, dataLoading, fetchError, takenCount, supplements.length]);

  const dateLine = formatTodayLongEs();

  const showEmptySupplements = !dataLoading && !fetchError && supplements.length === 0;
  const remaining = supplements.length - takenCount;
  const groups = React.useMemo(() => groupByMoment(supplements), [supplements]);
  const nowMoment = currentMoment();
  const { simpleMode } = useUiPrefs();
  const { estimate: energy, loading: energyLoading } = useEnergy(
    tracksCycle && cyclePhase
      ? {
          phase: cyclePhase,
          lastPeriodStart,
          cycleLengthDays,
          lifecycleContext: healthKitLifecycleContext,
        }
      : null,
    calendarDayKey,
    !healthLoading,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: SCREEN_PADDING_TOP_EXTRA + insets.top,
          paddingBottom:
            SCREEN_SCROLL_PADDING_BOTTOM_EXTRA + insets.bottom + FLOATING_TAB_BAR_EXTRA,
        },
      ]}
      {...(Platform.OS === 'ios' ? ({ contentInsetAdjustmentBehavior: 'never' } as const) : {})}
    >
      {fetchError && <ErrorBanner message={`Error al cargar datos:\n${fetchError.message}`} />}

      {dataLoading && !fetchError && <LoadingRow />}

      {/* Cabecera: emoji + nombre, fecha, pastilla fase; ajustes a la derecha */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.emojiText}>{userEmoji}</Text>
            <Text style={styles.userName}>{getProfileLabel(user)}</Text>
          </View>
          <Text style={styles.dateLine}>{dateLine}</Text>
          {tracksCycle && (
            <View style={styles.phasePill}>
              <View style={styles.phaseDot} />
              <Text style={styles.phasePillText}>
                {healthLoading ? 'Cargando fase…' : `Fase ${phaseLabel.toLowerCase()}`}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil y ajustes"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color={C.text} />
          <Text style={styles.settingsLabel}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      <EnergyCard estimate={energy} loading={energyLoading} />

      <View style={styles.todayHeaderBlock}>
        <View style={styles.todayHeaderRow}>
          <Text style={styles.sectionLabel}>Para hoy</Text>
          <Text
            style={styles.supCountInline}
            accessibilityLabel={`${takenCount} de ${supplements.length} suplementos tomados`}
          >
            {supplements.length === 0
              ? ''
              : remaining === 0
                ? 'Todo listo'
                : `Te faltan ${remaining}`}
          </Text>
        </View>
        <View style={styles.supProgressBarThin}>
          <View
            style={[
              styles.supProgressFillThin,
              {
                width: supplements.length ? `${(takenCount / supplements.length) * 100}%` : '0%',
              },
            ]}
          />
        </View>
      </View>

      {showEmptySupplements ? (
        <EmptyState
          message={
            !tracksCycle || cyclePhase
              ? `No hay suplementos para hoy. En Notion, marca «Disponible» y elige «${getNotionSupplementPersona(user)}» o «Compartido» en Persona.`
              : 'Aún no hay fase calculada. Revisa tu fila en la tabla de fases de Notion o el permiso de Apple Salud.'
          }
        />
      ) : !fetchError && supplements.length > 0 ? (
        <>
          {remaining === 0 && (
            <View style={styles.doneCard} accessibilityRole="summary">
              <Text style={styles.doneTitle}>✓ Listo por hoy</Text>
              <Text style={styles.doneText}>Ya marcaste todo. No hay nada más pendiente aquí.</Text>
            </View>
          )}
          {groups.map(({ moment, items }) => {
            const isNow = moment === nowMoment && remaining > 0;
            return (
              <View key={moment} style={styles.momentBlock}>
                <View style={styles.momentHeader}>
                  <Text style={[styles.momentLabel, isNow && styles.momentLabelNow]}>
                    {DOSE_MOMENT_LABEL[moment]}
                  </Text>
                  {isNow && <Text style={styles.nowBadge}>Ahora</Text>}
                </View>
                <View style={[styles.checklistCard, isNow && styles.checklistCardNow]}>
                  {items.map((s, index) => {
                    const localId = idByNotionId[s.notion_id];
                    const taken = localId ? isTaken(localId) : false;
                    const isLast = index === items.length - 1;
                    return (
                      <TouchableOpacity
                        key={s.notion_id}
                        style={[styles.supRow, !isLast && styles.supRowBorder]}
                        onPress={() => {
                          if (!localId) return;
                          markTaken(localId, !taken, undefined, s);
                        }}
                        activeOpacity={0.65}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: taken, disabled: !localId }}
                        accessibilityLabel={`${s.name}, ${s.dose}`}
                      >
                        <View style={[styles.checkboxOuter, taken && styles.checkboxOuterTaken]}>
                          {taken ? <Text style={styles.checkboxMark}>✓</Text> : null}
                        </View>
                        <View style={styles.supTextCol}>
                          <Text style={[styles.supName, taken && styles.supNameTaken]}>
                            {s.name}
                          </Text>
                          <Text style={styles.supDose}>{s.dose}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {/* Secundario: debajo de lo accionable; oculto en modo simple. */}
      {tracksCycle && !simpleMode && (
        <View style={styles.phaseCard}>
          <View style={styles.phaseLabels}>
            {(['menstrual', 'folicular', 'ovulatoria', 'lutea'] as const).map((p) => (
              <Text
                key={p}
                style={[
                  styles.phaseLbl,
                  currentPhase === p && { color: config.color, fontWeight: '600' },
                ]}
              >
                {PHASE_BAR_SHORT_LABELS[p]}
              </Text>
            ))}
          </View>

          <View style={styles.phaseTrack}>
            <View
              style={[
                styles.phaseFill,
                {
                  width: `${trackPercent}%`,
                  backgroundColor: config.fillColor,
                },
              ]}
            />
            <Text style={[styles.phaseMarker, { left: `${trackPercent}%` }]}>{config.emoji}</Text>
          </View>

          <View style={styles.phaseFooter}>
            <Text style={[styles.phaseMessage, { color: config.color }]}>{config.message}</Text>
          </View>
        </View>
      )}

      {!simpleMode && (
        <TeaCard tea={teas[currentIndex] ?? null} onNext={nextTea} canCycle={teas.length > 1} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: { flex: 1, paddingRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  emojiText: { fontSize: 22, lineHeight: 28 },
  userName: { fontSize: 22, fontWeight: '700', color: C.text },
  dateLine: { fontSize: 14, color: C.muted, marginTop: 4 },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.pillBg,
    gap: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },
  phasePillText: { fontSize: 13, fontWeight: '600', color: C.text },
  settingsBtn: {
    minWidth: 56,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  settingsLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
  phaseCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  phaseLbl: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  phaseTrack: {
    height: 11,
    backgroundColor: theme.trackBg,
    borderRadius: 6,
    marginBottom: 14,
    position: 'relative',
    overflow: 'visible',
  },
  phaseFill: { height: '100%', borderRadius: 6 },
  phaseMarker: { position: 'absolute', top: -11, fontSize: 24, transform: [{ translateX: -12 }] },
  phaseFooter: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  phaseMessage: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  todayHeaderBlock: { gap: 6 },
  todayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supCountInline: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
    fontVariant: ['tabular-nums'],
  },
  supProgressBarThin: {
    height: 4,
    backgroundColor: theme.trackBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  supProgressFillThin: { height: '100%', borderRadius: 2, backgroundColor: C.accent },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 0,
  },
  checklistCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  /** Grupo de «ahora»: borde de acento (además del texto «Ahora», no solo color). */
  checklistCardNow: { borderColor: C.accent, borderWidth: 2 },
  momentBlock: { gap: 8 },
  momentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  momentLabel: { fontSize: 15, fontWeight: '600', color: C.muted },
  momentLabelNow: { color: C.text },
  nowBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  doneCard: {
    backgroundColor: theme.accentSoft,
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  doneText: { fontSize: 15, color: C.text, lineHeight: 21 },
  supRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  supRowBorder: { borderBottomWidth: 1, borderBottomColor: C.rowDivider },
  checkboxOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.borderStrong,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOuterTaken: {
    borderColor: C.accent,
    backgroundColor: C.accent,
  },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: -1 },
  supTextCol: { flex: 1 },
  supName: { fontSize: 17, fontWeight: '600', color: C.text },
  /** Tomado: tachado + atenuado (no solo color). */
  supNameTaken: { textDecorationLine: 'line-through', color: C.muted },
  supDose: { fontSize: 14, color: C.muted, marginTop: 3, lineHeight: 19 },
});
