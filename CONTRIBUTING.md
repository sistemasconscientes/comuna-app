# Contribuir

Gracias por interesar en **La Comuna App**. PRs contra la rama **`oss/public`** (o `main` del repo público).

## Flujo

1. Fork del repo [`comuna-app`](https://github.com/sistemasconscientes/comuna-app).
2. Rama feature: `git checkout -b feat/mi-cambio`.
3. Cambios con **`npm test`** en verde.
4. Features no triviales: spec en `docs/specs/` (ver [`.cursor/rules/spec-driven.mdc`](.cursor/rules/spec-driven.mdc)).
5. PR con descripción y checklist de la plantilla.

## iOS primero

QA y releases oficiales son **iOS**. No rompas `expo run:ios` ni tests.

## Android (comunidad)

Ver [`docs/ANDROID_CONTRIBUTING.md`](docs/ANDROID_CONTRIBUTING.md). Sin garantía de review prioritaria.

## Secretos

- No commitear `.env`, `eas.json` con URLs reales, `profiles.local.ts`.
- Pre-push recomendado:

```bash
gitleaks detect --source . --no-git
# o: trufflehog filesystem .
git grep -E 'secret_|sk-|mongodb\+srv://|phc_' -- ':!*.md'
```

## GitHub Discussions

Activa **Discussions** en tu fork para Q&A; usa **Issues** para bugs y features.

## Código de conducta

Ver [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
