import 'react-native-gesture-handler';
import React, { ErrorInfo } from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { POSTHOG_API_KEY, POSTHOG_HOST } from '@env';
import App from './App';
import { getAppEnvironment, reportErrorToSentry } from './src/utils/observability';
import { theme } from './src/theme/colors';

const hasPostHog = Boolean((POSTHOG_API_KEY ?? '').trim());
const posthogHost = (POSTHOG_HOST ?? '').trim() || 'https://us.i.posthog.com';

function PostHogErrorFallback({ error }: { error: unknown; componentStack: string }) {
  return (
    <View style={fallbackStyles.container}>
      <Text style={fallbackStyles.title}>Algo salió mal</Text>
      <Text style={fallbackStyles.message}>
        {error instanceof Error ? error.message : String(error)}
      </Text>
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: theme.text },
  message: { fontSize: 15, color: theme.textSecondary },
});

type RootBoundaryState = {
  error: unknown | null;
  componentStack: string;
};

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, RootBoundaryState> {
  state: RootBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: unknown): Partial<RootBoundaryState> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportErrorToSentry(error, {
      domain: 'react_render',
      component_stack: info.componentStack ?? '',
    });
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  render(): React.ReactNode {
    const { error, componentStack } = this.state;
    if (error != null) {
      return <PostHogErrorFallback error={error} componentStack={componentStack} />;
    }
    return this.props.children;
  }
}

/** Super-propiedad en todos los eventos PostHog (filtrar dev / preview / prod en el dashboard). */
function PostHogRegisterAppEnvironment() {
  const posthog = usePostHog();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!hasPostHog || !posthog || done.current) return;
    done.current = true;
    void posthog.register({ app_environment: getAppEnvironment() });
  }, [posthog]);
  return null;
}

/** Una vez por cold start en dev, si PostHog está activo — revisar en PostHog → Activity / Live events. */
function PostHogIntegrationVerify() {
  const posthog = usePostHog();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!__DEV__ || !hasPostHog || done.current || !posthog) return;
    done.current = true;
    posthog.capture('posthog_integration_verify', {
      trigger: 'app_start_dev',
      at: new Date().toISOString(),
    });
  }, [posthog]);
  return null;
}

function Root() {
  return (
    <PostHogProvider
      apiKey={hasPostHog ? (POSTHOG_API_KEY as string).trim() : 'phc_placeholder'}
      autocapture={false}
      options={{
        disabled: !hasPostHog,
        host: posthogHost,
        captureAppLifecycleEvents: false,
      }}
    >
      <RootErrorBoundary>
        <SafeAreaProvider>
          <PostHogRegisterAppEnvironment />
          <PostHogIntegrationVerify />
          <App />
        </SafeAreaProvider>
      </RootErrorBoundary>
    </PostHogProvider>
  );
}

registerRootComponent(Root);
