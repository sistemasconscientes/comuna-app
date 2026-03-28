jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (Component) => Component,
  captureException: jest.fn(() => ''),
  getClient: jest.fn(() => null),
  feedbackIntegration: jest.fn(() => ({})),
}));
