# La Comuna App — guía para agentes

App iOS Expo + Notion + SQLite. Arquitectura completa: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Comandos

- `npx expo run:ios` — desarrollo (no Expo Go)
- `npm test` — Jest + `version:check`
- `npm run version:sync` — alinear versión con `app.json`

## Convenciones

- Hooks en `src/hooks/use<Domain>.ts`; lógica fuera de screens.
- Specs en `docs/specs/` para features no triviales.
- Perfiles: `src/config/profiles.ts` (máx. 2); overrides en `profiles.local.ts` (build) o en runtime desde Perfil.
- Config de Notion en **runtime** (`src/config/notionSettings.ts`): onboarding in-app → fallback `.env`. Ver [`docs/specs/notion-runtime-settings.md`](docs/specs/notion-runtime-settings.md).

Ver también [`.cursor/rules/`](.cursor/rules/) y [CONTRIBUTING.md](CONTRIBUTING.md).
