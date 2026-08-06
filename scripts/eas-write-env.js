/**
 * En EAS Build materializa `.env` desde las env vars del worker para que
 * babel-plugin-dotenv-import (`@env`) las vea: las EAS env vars llegan como
 * process.env pero babel solo lee el archivo `.env` (gitignored, ausente en la nube).
 * Fuera de EAS, o si ya existe `.env`, no hace nada.
 */
const fs = require('fs');
const path = require('path');

const KEYS = ['SENTRY_DSN', 'POSTHOG_API_KEY', 'POSTHOG_HOST'];

const envPath = path.join(__dirname, '..', '.env');

if (process.env.EAS_BUILD !== 'true' || fs.existsSync(envPath)) {
  process.exit(0);
}

const present = KEYS.filter((key) => process.env[key]);
const lines = present.map((key) => `${key}=${process.env[key]}`);
// Siempre escribe el archivo (aunque quede vacío) para que dotenv-import no falle por ENOENT.
fs.writeFileSync(envPath, lines.length ? `${lines.join('\n')}\n` : '');
console.log(`[eas-write-env] .env generado con: ${present.join(', ') || '(ninguna var presente)'}`);
