import { StyleSheet, Text, View } from 'react-native';
import { useIsOffline } from '../hooks/useNetworkStatus';
import { theme } from '../theme/colors';

/**
 * Banner app-wide que avisa cuando no hay conexión. La app sigue funcionando con
 * datos cacheados (useCache); esto solo señala que pueden estar desactualizados.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel="Sin conexión">
      <Text style={styles.text}>Sin conexión — mostrando datos guardados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.warningBg,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: theme.warningText,
    fontSize: 13,
    fontWeight: '600',
  },
});
