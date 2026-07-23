import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotionConnection, type NotionConnectStep } from '../hooks/useNotionConnection';
import { theme } from '../theme/colors';

const TEMPLATE_URL = 'https://www.notion.com/es/templates/comuna-app';
const INTEGRATIONS_URL = 'https://www.notion.so/my-integrations';

const STEP_LABELS: Record<Exclude<NotionConnectStep, 'idle'>, string> = {
  checking_token: 'Validando token…',
  discovering: 'Buscando tu template…',
  saving: 'Guardando…',
};

type NotionOnboardingProps = {
  /** La conexión quedó guardada; la app puede continuar al gate de perfil. */
  onConnected: () => void;
};

export default function NotionOnboarding({ onConnected }: NotionOnboardingProps) {
  const insets = useSafeAreaInsets();
  const { step, error, connectAuto, connectManual, busy } = useNotionConnection(onConnected);

  const [token, setToken] = React.useState('');
  const [manualOpen, setManualOpen] = React.useState(false);
  const [supplementsDbId, setSupplementsDbId] = React.useState('');
  const [phasesPageId, setPhasesPageId] = React.useState('');
  const [mealPrepHubPageId, setMealPrepHubPageId] = React.useState('');

  const canConnect = token.trim().length > 0 && !busy;
  const canConnectManual = canConnect && supplementsDbId.trim() && phasesPageId.trim();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Conecta tu Notion</Text>
        <Text style={styles.subtitle}>
          La Comuna guarda tus suplementos y fases en tu propio workspace de Notion. Solo necesitas
          hacerlo una vez.
        </Text>

        <View style={styles.stepsCard}>
          <Text style={styles.stepLine}>
            <Text style={styles.stepNumber}>1. </Text>
            Duplica el{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(TEMPLATE_URL)}
            >
              template de La Comuna
            </Text>{' '}
            en tu workspace.
          </Text>
          <Text style={styles.stepLine}>
            <Text style={styles.stepNumber}>2. </Text>
            Crea una{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(INTEGRATIONS_URL)}
            >
              integración interna
            </Text>{' '}
            en Notion y copia su token.
          </Text>
          <Text style={styles.stepLine}>
            <Text style={styles.stepNumber}>3. </Text>
            En Notion, comparte las páginas del template con tu integración (··· → Conexiones).
          </Text>
          <Text style={styles.stepLine}>
            <Text style={styles.stepNumber}>4. </Text>
            Pega el token aquí. Se guarda cifrado en tu teléfono.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="ntn_… o secret_…"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          accessibilityLabel="Token de integración de Notion"
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, !canConnect && styles.btnDisabled]}
          onPress={() => connectAuto(token)}
          disabled={!canConnect}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Conectar con Notion"
        >
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={theme.text} />
              <Text style={styles.primaryBtnText}>
                {step !== 'idle' ? STEP_LABELS[step] : 'Conectando…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Conectar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualToggle}
          onPress={() => setManualOpen((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.manualToggleText}>
            {manualOpen
              ? 'Ocultar IDs manuales'
              : '¿La detección no encuentra tu template? Pega los IDs'}
          </Text>
        </TouchableOpacity>

        {manualOpen && (
          <View style={styles.manualCard}>
            <TextInput
              style={styles.input}
              value={supplementsDbId}
              onChangeText={setSupplementsDbId}
              placeholder="ID de la base de datos de Suplementos"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              accessibilityLabel="ID de la base de datos de suplementos"
            />
            <TextInput
              style={styles.input}
              value={phasesPageId}
              onChangeText={setPhasesPageId}
              placeholder="ID de la página de Fases"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              accessibilityLabel="ID de la página de fases"
            />
            <TextInput
              style={styles.input}
              value={mealPrepHubPageId}
              onChangeText={setMealPrepHubPageId}
              placeholder="ID del hub de Comidas (opcional)"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              accessibilityLabel="ID del hub de comidas, opcional"
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, !canConnectManual && styles.btnDisabled]}
              onPress={() =>
                connectManual(token, { supplementsDbId, phasesPageId, mealPrepHubPageId })
              }
              disabled={!canConnectManual}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Conectar con IDs manuales"
            >
              <Text style={styles.secondaryBtnText}>Conectar con estos IDs</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.textSecondary, lineHeight: 21 },
  stepsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  stepLine: { fontSize: 14, color: theme.text, lineHeight: 20 },
  stepNumber: { fontWeight: '700', color: theme.textSecondary },
  link: { color: '#C97B6E', textDecorationLine: 'underline' },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 12,
    backgroundColor: theme.bgElevated,
    color: theme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: theme.warningBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  errorText: { color: theme.warningText, fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accent,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: theme.text },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnDisabled: { opacity: 0.5 },
  manualToggle: { alignItems: 'center', paddingVertical: 4 },
  manualToggleText: { fontSize: 13, color: theme.textSecondary, textDecorationLine: 'underline' },
  manualCard: { gap: 10 },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: theme.text },
});
