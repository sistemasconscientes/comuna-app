# Android — contribuciones comunitarias

El mantenedor (**Laboratorio de Sistemas Conscientes**) **no usa Android** ni garantiza QA en esa plataforma. Las PRs Android son bienvenidas pero pueden tardar en revisarse.

## Expectativas

- **HealthKit no existe en Android:** pestaña Salud, sync automático de ciclo y `updatePhase` desde Salud **no aplican**. Opciones para forks: pantalla informativa, solo Notion/SQLite, o integrar Health Connect (fuera de alcance del mantenedor).
- `@kingstinct/react-native-healthkit` es **iOS-only**.
- Notion, SQLite, backend stock y Comidas deberían funcionar con `.env` correcto.

## Setup local

```bash
npm install
cp .env.example .env
npx expo run:android
```

Requiere Android Studio / JDK — [documentación Expo](https://docs.expo.dev/workflow/android-studio-emulator/).

Cambia `android.package` en `app.json` si publicas build propia.

## Build EAS

```bash
cp eas.json.example eas.json   # ajustar perfiles
eas build --profile development --platform android
```

## PR aceptable

- App arranca: gate de perfiles, tabs, sync Notion, stock local.
- Salud: mensaje claro “solo iOS”, sin crash.
- **No romper iOS:** `npm test` debe pasar.

## iOS sigue siendo la ruta principal

CI y releases oficiales son iOS. Ver [`CONTRIBUTING.md`](../CONTRIBUTING.md).
