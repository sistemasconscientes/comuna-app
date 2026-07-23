# Fork setup — checklist

Pasos después de hacer fork de [`comuna-app`](https://github.com/sistemasconscientes/comuna-app).

## Notion

- [ ] Clonar [template Marketplace](https://www.notion.com/es/templates/comuna-app) — ver [`NOTION_SETUP.md`](NOTION_SETUP.md)
- [ ] `.env` con `NOTION_*`
- [ ] Alinear select **Persona** en la DB con tus perfiles (`profiles.local.ts`)

## App local

- [ ] `npm install`
- [ ] `cp eas.json.example eas.json` si usas EAS
- [ ] `npx expo run:ios` (no Expo Go)
- [ ] Opcional: `src/config/profiles.local.ts` desde `profiles.local.example.ts`

## Identificadores

- [ ] **Bundle ID:** el repo usa `com.janee.comunaapp`. Si publicas en App Store con app modificada, registra **tu propio** bundle ID en Apple Developer y actualiza `app.json`.
- [ ] **EAS:** `eas init` → copiar `projectId` y `owner` a `app.json` (ver `app.config.example.json`)
- [ ] **Sentry:** org/proyecto propios en plugin de `app.json`

## Backend stock (opcional)

- [ ] `docker compose up -d` o MongoDB Atlas
- [ ] `backend/.env` con `MONGODB_URI`, `API_KEY`
- [ ] `EXPO_PUBLIC_BACKEND_URL` + `BACKEND_API_KEY` en `.env` de la app
- [ ] En dispositivo físico: IP LAN del Mac, no `localhost`

## Antes del primer push público

- [ ] No commitear `.env`, `eas.json` con URLs reales, ni `profiles.local.ts`
- [ ] Escaneo de secretos: `gitleaks detect --source .` o `trufflehog filesystem .`

## GitHub (repo fork)

- [ ] Activar **Discussions** para Q&A
- [ ] Topics: `expo`, `notion-api`, `healthkit`, `react-native`, `gpl-3.0`
