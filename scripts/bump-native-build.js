/**
 * Incrementa nativeBuild en +1 y sincroniza app.json (ios.buildNumber, android.versionCode).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const nb = Number.parseInt(String(pkg.nativeBuild), 10);
if (!Number.isFinite(nb) || nb < 1) {
  throw new Error('package.json: "nativeBuild" debe ser un entero >= 1.');
}

const next = nb + 1;
pkg.nativeBuild = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

execFileSync(process.execPath, [path.join(__dirname, 'sync-version.js')], {
  cwd: root,
  stdio: 'inherit',
});

console.log(`[version:bump:native] nativeBuild ${nb} → ${next}`);
