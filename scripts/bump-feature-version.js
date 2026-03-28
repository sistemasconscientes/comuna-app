/**
 * Incrementa el tercer dígito de version (versión.hito.feature) y sincroniza expo.version en app.json.
 * Formato esperado: X.Y.Z (solo dígitos, sin prerelease).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const v = pkg.version;
if (typeof v !== 'string' || !v) {
  throw new Error('package.json debe tener "version" (semver).');
}

const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
if (!m) {
  throw new Error(
    `version "${v}" no coincide con X.Y.Z (solo números). Editá a mano major/minor o usá formato 1.2.3.`
  );
}

const major = m[1];
const minor = m[2];
const feature = Number.parseInt(m[3], 10) + 1;
const next = `${major}.${minor}.${feature}`;
pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

execFileSync(process.execPath, [path.join(__dirname, 'sync-version.js')], {
  cwd: root,
  stdio: 'inherit',
});

console.log(`[version:bump:feature] version ${v} → ${next}`);
