import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Tea } from '../types';
import { theme } from '../theme/colors';

type TeaCardProps = {
  /** Té actual a mostrar; `null` cuando no hay tés en casa para la fase. */
  tea: Tea | null;
  /** Rota al siguiente té. */
  onNext?: () => void;
  /** Muestra el botón "quiero otro" (solo si hay más de un té). */
  canCycle?: boolean;
};

export default function TeaCard({ tea, onNext, canCycle = false }: TeaCardProps) {
  if (!tea) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Té del día</Text>
        <Text style={styles.emptyText}>ningún té en casa para esta fase</Text>
      </View>
    );
  }

  const benefit = tea.comprovable_benefits[0] ?? '';

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Té del día</Text>
      <Text style={styles.teaName}>{tea.name}</Text>
      {benefit ? <Text style={styles.teaBenefit}>{benefit}</Text> : null}
      {canCycle ? (
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={onNext}
          activeOpacity={0.7}
          accessibilityLabel="Quiero otro té"
        >
          <Text style={styles.nextBtnText}>quiero otro</Text>
        </TouchableOpacity>
      ) : null}
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
  teaName: { fontSize: 18, fontWeight: '700', color: theme.text },
  teaBenefit: { fontSize: 14, lineHeight: 20, color: theme.textSecondary },
  emptyText: { color: theme.textMuted, fontStyle: 'italic', fontSize: 15 },
  nextBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.pillBg,
  },
  nextBtnText: { fontSize: 13, fontWeight: '600', color: theme.text },
});
