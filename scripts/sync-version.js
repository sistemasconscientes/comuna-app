/**
 * Sincroniza desde package.json hacia app.json:
 * - version → expo.version
 * - nativeBuild → ios.buildNumber (string) y android.versionCode (entero)
 *   (Android solo coherencia Expo; releases del proyecto son iOS-only.)
 *
 * Uso:
 *   node scripts/sync-version.js           — escribe app.json
 *   node scripts/sync-version.js --check   — solo valida (CI / npm test)
 */
const fs = require('fs');
const path = require('path');

const checkOnly = process.argv.includes('--check');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

if (typeof pkg.version !== 'string' || !pkg.version) {
  throw new Error('package.json debe tener "version" (semver).');
}

const nb = Number.parseInt(String(pkg.nativeBuild), 10);
if (!Number.isFinite(nb) || nb < 1) {
  throw new Error(
    'package.json debe tener "nativeBuild": <entero> (>= 1) para iOS buildNumber y Android versionCode.',
  );
}

const expo = app.expo || {};
const actualVersion = expo.version;
const actualIos = expo.ios && expo.ios.buildNumber;
const actualAndroid = expo.android && expo.android.versionCode;

if (checkOnly) {
  const errs = [];
  if (actualVersion !== pkg.version) {
    errs.push(
      `expo.version es "${actualVersion}" pero package.json "version" es "${pkg.version}". Ejecuta: npm run version:sync`,
    );
  }
  if (String(actualIos) !== String(nb)) {
    errs.push(
      `ios.buildNumber es "${actualIos}" pero package.json "nativeBuild" es ${nb}. Ejecuta: npm run version:sync`,
    );
  }
  if (Number(actualAndroid) !== nb) {
    errs.push(
      `android.versionCode es ${actualAndroid} pero package.json "nativeBuild" es ${nb}. Ejecuta: npm run version:sync`,
    );
  }
  if (errs.length) {
    console.error('[version:check] app.json no está alineado con package.json:\n');
    errs.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  process.exit(0);
}

app.expo = app.expo || {};
app.expo.version = pkg.version;
app.expo.ios = app.expo.ios || {};
app.expo.ios.buildNumber = String(nb);
app.expo.android = app.expo.android || {};
app.expo.android.versionCode = nb;

fs.writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);
