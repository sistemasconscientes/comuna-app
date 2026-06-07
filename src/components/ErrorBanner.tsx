import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/colors';

/** Banner de error inline (carga de datos fallida). Reutilizable entre screens. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: theme.errorBg, borderRadius: 12, padding: 12, marginBottom: 4 },
  text: { color: theme.errorText, fontSize: 13 },
});
