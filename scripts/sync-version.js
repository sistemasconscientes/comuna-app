/**
 * Sincroniza desde package.json hacia app.json:
 * - version → expo.version
 * - nativeBuild → ios.buildNumber (string) y android.versionCode (entero)
 */
const fs = require('fs');
const path = require('path');

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
    'package.json debe tener "nativeBuild": <entero> (>= 1) para iOS buildNumber y Android versionCode.'
  );
}

app.expo = app.expo || {};
app.expo.version = pkg.version;
app.expo.ios = app.expo.ios || {};
app.expo.ios.buildNumber = String(nb);
app.expo.android = app.expo.android || {};
app.expo.android.versionCode = nb;

fs.writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);
