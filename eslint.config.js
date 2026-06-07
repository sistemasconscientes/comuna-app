// Flat config (ESLint 9). Base: eslint-config-expo. Formato lo maneja Prettier
// (eslint-config-prettier desactiva reglas de estilo que chocarían).
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'src/db/migrations/**', // generadas por drizzle-kit
      'backend/**', // proyecto Node/Express separado; lint propio aparte
    ],
  },
  ...expoConfig,
  eslintConfigPrettier,
  {
    rules: {
      // `@env` (alias de babel-plugin-dotenv-import) y varias deps transitivas de
      // Expo no se resuelven estáticamente; el resolver da falsos positivos.
      'import/no-unresolved': 'off',
      // Reglas nuevas del react-compiler (eslint-config-expo 56): útiles como señal,
      // pero su corrección es trabajo aparte (ver roadmap Fase 3). No bloquean CI.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Scripts de build y archivos de config: entorno Node/CommonJS.
    files: ['scripts/**/*.js', '*.config.js', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Tests y setup de Jest.
    files: ['**/*.test.{ts,tsx,js,jsx}', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
