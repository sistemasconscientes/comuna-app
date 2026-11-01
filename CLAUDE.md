# La Comuna App — guía para agentes

App iOS Expo + Notion + SQLite. Arquitectura completa: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Comandos

- `npx expo run:ios` — desarrollo (no Expo Go)
- `npm test` — Jest + `version:check`
- `npm run version:sync` — alinear versión con `app.json`

## Convenciones

- Hooks en `src/hooks/use<Domain>.ts`; lógica fuera de screens.
- Specs en `docs/specs/` para features no triviales.
- Perfiles: `src/config/profiles.ts` (1 a 8, posicionales `profile_N`; cada uno puede seguir ciclo o no — ver [`docs/specs/multi-profile-cycle-optional.md`](docs/specs/multi-profile-cycle-optional.md)); overrides en `profiles.local.ts` (build) o en runtime desde Perfil. `Compartido` / `Ambas` en Persona = todo el hogar.
- Tareas del hogar (pestaña Casa): `getChores` / `setChoreLastDone` en `src/api/notion.ts`, `src/utils/choreSchedule.ts`, `useChores` — ver [`docs/specs/household-chores.md`](docs/specs/household-chores.md).
- Config de Notion en **runtime** (`src/config/notionSettings.ts`): onboarding in-app → fallback `.env`. Ver [`docs/specs/notion-runtime-settings.md`](docs/specs/notion-runtime-settings.md).

Ver también [`.cursor/rules/`](.cursor/rules/) y [CONTRIBUTING.md](CONTRIBUTING.md).
