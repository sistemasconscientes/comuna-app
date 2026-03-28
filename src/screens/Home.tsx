import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHealthData } from '../hooks/useHealthData';
import { useSupplements } from '../hooks/useSupplements';
import { useDailyLog } from '../hooks/useDailyLog';
import { useUser, type User } from '../context/UserContext';
import type { Phase } from '../types';
import { DEFAULT_CYCLE_LENGTH_DAYS } from '../utils/phaseCalculator';

const DEFAULT_USER_EMOJI = '🌿';

/** Paleta alineada con referencia: crema + terracota */
const C = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  accent: '#C97B6E',
  text: '#2C2C2C',
  muted: '#8E8E8E',
  border: '#E8E4DC',
  pillBg: '#FCE8E6',
  rowDivider: '#EFEAE4',
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

const USER_LABELS: Record<User, string> = {
  diana: 'Diana',
  estefania: 'Estefanía',
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

  const { cyclePhase, cycleDay, loading: healthLoading, error: healthError } = useHealthData(user);
  const { supplements, idByNotionId, error: supplementsError } = useSupplements(
    user,
    cyclePhase ?? '',
  );
  const { isTaken, markTaken } = useDailyLog(user);

  const phaseLabel = cyclePhase ? PHASE_PILL_LABELS[cyclePhase] : '—';

  const currentPhase: Phase =
    cyclePhase === 'ovulacion'
      ? 'ovulatoria'
      : cyclePhase === 'menstrual' || cyclePhase === 'folicular' || cyclePhase === 'lutea'
        ? cyclePhase
        : 'menstrual';

  const config = PHASE_CONFIG[currentPhase];
  const trackPercent =
    cycleDay !== null
      ? Math.min(100, (cycleDay / DEFAULT_CYCLE_LENGTH_DAYS) * 100)
      : config.fillPercent;

  const takenCount = supplements.reduce((count, s) => {
    const localId = idByNotionId[s.notion_id];
    if (!localId) return count;
    return count + (isTaken(localId) ? 1 : 0);
  }, 0);

  const dateLine = formatTodayLongEs();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {(healthError || supplementsError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Error al cargar datos de Notion:{'\n'}
            {(healthError ?? supplementsError)?.message}
          </Text>
        </View>
      )}

      {/* Cabecera: emoji + nombre, fecha, pastilla fase; ajustes a la derecha */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.emojiText}>{userEmoji}</Text>
            <Text style={styles.userName}>{USER_LABELS[user]}</Text>
          </View>
          <Text style={styles.dateLine}>{dateLine}</Text>
          <View style={styles.phasePill}>
            <View style={styles.phaseDot} />
            <Text style={styles.phasePillText}>
              {healthLoading ? 'Cargando fase…' : `Fase ${phaseLabel.toLowerCase()}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          accessibilityLabel="Abrir perfil y ajustes"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

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

      <View style={styles.todayHeaderBlock}>
        <View style={styles.todayHeaderRow}>
          <Text style={styles.sectionLabel}>Para hoy</Text>
          <Text style={styles.supCountInline} accessibilityLabel={`${takenCount} de ${supplements.length} suplementos tomados`}>
            {takenCount}/{supplements.length}
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

      {supplements.length === 0 ? (
        <Text style={styles.emptyText}>
          {cyclePhase ? 'Sin suplementos para esta fase.' : 'Sin datos de fase.'}
        </Text>
      ) : (
        <View style={styles.checklistCard}>
          {supplements.map((s, index) => {
            const localId = idByNotionId[s.notion_id];
            const taken = localId ? isTaken(localId) : false;
            const isLast = index === supplements.length - 1;
            return (
              <TouchableOpacity
                key={s.notion_id}
                style={[styles.supRow, !isLast && styles.supRowBorder]}
                onPress={() => {
                  if (!localId) return;
                  markTaken(localId, !taken);
                }}
                activeOpacity={0.65}
              >
                <View style={[styles.checkboxOuter, taken && styles.checkboxOuterTaken]}>
                  {taken ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <View style={styles.supTextCol}>
                  <Text style={styles.supName}>{s.name}</Text>
                  <Text style={styles.supDose}>{s.dose}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 14 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20, color: C.text },
  phaseCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  phaseLbl: { fontSize: 11, color: '#b8b4ae', fontWeight: '500' },
  phaseTrack: {
    height: 11,
    backgroundColor: '#f0ece6',
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
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
    fontVariant: ['tabular-nums'],
  },
  supProgressBarThin: {
    height: 4,
    backgroundColor: '#E5E0D8',
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
  emptyText: { color: C.muted, fontStyle: 'italic', fontSize: 15 },
  checklistCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  supRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  supRowBorder: { borderBottomWidth: 1, borderBottomColor: C.rowDivider },
  checkboxOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D4CFC6',
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
  supName: { fontSize: 16, fontWeight: '600', color: C.text },
  supDose: { fontSize: 13, color: C.muted, marginTop: 3 },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  errorText: { color: '#C62828', fontSize: 13 },
});
