import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';
import { View, Text, StyleSheet } from 'react-native';
import { PostHogProvider, PostHogErrorBoundary, usePostHog } from 'posthog-react-native';
import { POSTHOG_API_KEY, POSTHOG_HOST } from '@env';
import App from './App';

const hasPostHog = Boolean((POSTHOG_API_KEY ?? '').trim());
const posthogHost = (POSTHOG_HOST ?? '').trim() || 'https://us.i.posthog.com';

function PostHogErrorFallback({
  error,
}: {
  error: unknown;
  componentStack: string;
}) {
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
    backgroundColor: '#FAFAFA',
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#222' },
  message: { fontSize: 15, color: '#444' },
});

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
        ...(hasPostHog && {
          errorTracking: {
            autocapture: {
              uncaughtExceptions: true,
              unhandledRejections: true,
              console: ['error', 'warn'] as const,
            },
          },
        }),
      }}
    >
      <PostHogErrorBoundary fallback={PostHogErrorFallback}>
        <PostHogIntegrationVerify />
        <App />
      </PostHogErrorBoundary>
    </PostHogProvider>
  );
}

registerRootComponent(Root);
