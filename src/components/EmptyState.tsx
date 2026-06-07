import { StyleSheet, Text } from 'react-native';
import { theme } from '../theme/colors';

/** Texto de estado vacío reutilizable entre screens. */
export function EmptyState({ message }: { message: string }) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { color: theme.textMuted, fontStyle: 'italic', fontSize: 15 },
});
