/**
 * En EAS Build con perfil "preview", sube nativeBuild +1 antes de npm ci
 * para que cada IPA tenga buildNumber distinto (TestFlight).
 */
const path = require('path');
const { execFileSync } = require('child_process');

if (process.env.EAS_BUILD_PROFILE !== 'preview') {
  process.exit(0);
}

const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'bump-native-build.js')], {
  cwd: root,
  stdio: 'inherit',
});
