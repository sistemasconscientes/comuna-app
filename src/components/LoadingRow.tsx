import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/colors';

/** Fila de carga (spinner + texto) reutilizable entre screens. */
export function LoadingRow({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <View style={styles.row} accessibilityLabel="Cargando datos">
      <ActivityIndicator size="small" color={theme.accent} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  text: { fontSize: 14, color: theme.textMuted },
});
