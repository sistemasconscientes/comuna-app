import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { EnergyEstimate, EnergyLevel } from '../utils/energy';
import { formatDurationHM } from '../utils/healthObservation';
import { theme } from '../theme/colors';

/** Nivel con símbolo + palabra (no depende solo del color). */
const LEVEL_LABEL: Record<EnergyLevel, { symbol: string; text: string; color: string }> = {
  baja: { symbol: '○', text: 'Baja', color: '#E08A7B' },
  media: { symbol: '◐', text: 'Media', color: '#D9B25F' },
  alta: { symbol: '●', text: 'Alta', color: '#8DBF8B' },
};

type EnergyCardProps = {
  estimate: EnergyEstimate | null;
  loading: boolean;
};

/** Energía disponible de hoy según el sueño de Apple Salud (orientativo). */
export default function EnergyCard({ estimate, loading }: EnergyCardProps) {
  const [howOpen, setHowOpen] = React.useState(false);

  if (loading) return null;

  if (!estimate) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Energía de hoy</Text>
        <Text style={styles.emptyText}>
          Sin sueño de anoche en Apple Salud. Con un registro de sueño (iPhone o Watch) verás aquí
          tu energía estimada.
        </Text>
      </View>
    );
  }

  const lvl = LEVEL_LABEL[estimate.level];
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Energía de hoy: ${lvl.text}. Dormiste ${formatDurationHM(estimate.lastNightMs)}. ${estimate.suggestion}`}
    >
      <Text style={styles.sectionLabel}>Energía de hoy</Text>
      <View style={styles.levelRow}>
        <Text style={[styles.levelSymbol, { color: lvl.color }]}>{lvl.symbol}</Text>
        <Text style={styles.levelText}>{lvl.text}</Text>
        <Text style={styles.sleepText}>· dormiste {formatDurationHM(estimate.lastNightMs)}</Text>
      </View>
      <Text style={styles.suggestion}>{estimate.suggestion}</Text>
      {estimate.phaseNote ? <Text style={styles.phaseNote}>{estimate.phaseNote}</Text> : null}
      <TouchableOpacity
        onPress={() => setHowOpen((v) => !v)}
        style={styles.howBtn}
        accessibilityRole="button"
        accessibilityState={{ expanded: howOpen }}
      >
        <Text style={styles.howBtnText}>
          {howOpen ? 'Ocultar cómo se calcula' : '¿Cómo se calcula?'}
        </Text>
      </TouchableOpacity>
      {howOpen && (
        <Text style={styles.howText}>
          Compara tu sueño de anoche ({formatDurationHM(estimate.lastNightMs)}) con{' '}
          {estimate.baselineKind === 'fase'
            ? `tu sueño habitual en esta misma fase del ciclo (${formatDurationHM(estimate.baselineMs)})`
            : estimate.baselineKind === 'personal'
              ? `tu sueño habitual de las últimas noches (${formatDurationHM(estimate.baselineMs)})`
              : `una referencia de ${formatDurationHM(estimate.baselineMs)} (aún hay pocas noches registradas)`}
          .{' '}
          {estimate.phaseAdjusted
            ? 'En esta fase el sueño suele ser más ligero, así que pide un poco más: menos de 5 h 30 o del 85 % = baja; menos de 7 h o del 97 % = media.'
            : 'Menos de 5 h o del 80 % = baja; menos de 6 h 30 o del 92 % = media.'}{' '}
          Usa el sueño registrado en Apple Salud de este teléfono. Es una guía, no una medición
          médica.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  levelSymbol: { fontSize: 22, fontWeight: '700' },
  levelText: { fontSize: 22, fontWeight: '700', color: theme.text },
  sleepText: { fontSize: 15, color: theme.textSecondary },
  suggestion: { fontSize: 15, color: theme.text, lineHeight: 21 },
  phaseNote: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  emptyText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  howBtn: { alignSelf: 'flex-start', paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  howBtnText: { fontSize: 14, fontWeight: '600', color: theme.accent },
  howText: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
});
