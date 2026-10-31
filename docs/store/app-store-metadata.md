# App Store Connect — metadata, notas al reviewer y App Privacy

Borradores listos para pegar al crear la ficha en App Store Connect. Complementa el flujo de release en [`docs/specs/release-versioning.md`](../specs/release-versioning.md) (sección «App Store»).

## Ficha

| Campo                    | Valor propuesto                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nombre** (máx. 30)     | `La Comuna — Ciclo y tomas`                                                                                                                                                                                                                        |
| **Subtítulo** (máx. 30)  | `Suplementos según tu fase`                                                                                                                                                                                                                        |
| **Categoría primaria**   | Salud y forma física (Health & Fitness)                                                                                                                                                                                                            |
| **Categoría secundaria** | Estilo de vida (opcional)                                                                                                                                                                                                                          |
| **Age rating**           | **18+** (decisión de producto, oct 2026). En el cuestionario nuevo (4+/9+/13+/16+/18+): contestar «Medical or Treatment-Focused Content» y «Health or Wellness Topics» con honestidad y fijar la edad mínima en 18+ con el override de edad de ASC |
| **Precio**               | Gratis. Sin compras in-app. Proyecto open source (GPL-3.0) sin fines de lucro; donaciones **solo** vía GitHub Sponsors en el repo, nunca dentro de la app (guideline 3.2.2)                                                                        |
| **URL de soporte**       | <https://github.com/sistemasconscientes/comuna-app/issues>                                                                                                                                                                                         |
| **URL de privacidad**    | <https://github.com/sistemasconscientes/comuna-app/blob/main/docs/PRIVACY.md>                                                                                                                                                                      |
| **Copyright**            | © 2026 Sistemas Conscientes                                                                                                                                                                                                                        |

> El nombre en App Store debe ser único globalmente; si `La Comuna` está tomado, alternativas: `La Comuna: suplementos y ciclo`, `Comuna — ciclo menstrual`.

## Descripción (borrador)

```
La Comuna organiza los suplementos de tu casa: uno o varios perfiles (pareja, familia, roomies), cada quien con su lista del día. Quien sigue su ciclo menstrual puede alinear sus suplementos a sus fases; quien no, simplemente los ve por día.

Conecta tu propio workspace de Notion —tus datos viven contigo, no en nuestros servidores— y la app organiza tus suplementos, tés y plan de comidas.

• Hasta 8 perfiles por teléfono, con o sin seguimiento de ciclo
• Registro diario de tomas con recordatorios locales
• Fase estimada con datos de Apple Salud (opcional, con tu permiso, solo en tu dispositivo)
• Control de stock con aviso de recompra
• Plan de comidas de la semana desde tu Notion
• Sección Salud: sueño, frecuencia cardiaca, HRV y más señales de Apple Salud, en modo observación

Sin cuenta, sin registro, sin anuncios. La app funciona con el token de una integración interna de Notion que tú creas y controlas; también puedes explorarla con datos de ejemplo sin conectar nada.

Proyecto open source (GPL-3.0) y sin fines de lucro: audita exactamente qué hace la app en github.com/sistemasconscientes/comuna-app

La Comuna no es un dispositivo médico: no prescribe suplementos ni dosis y no sustituye el consejo de un profesional de la salud.
```

## Keywords (máx. 100 caracteres)

```
ciclo,menstrual,suplementos,vitaminas,notion,fases,hogar,roomies,tomas,hábitos,recordatorio
```

(91 caracteres; no repetir palabras que ya están en nombre/subtítulo si se necesita espacio.)

## Notas al reviewer (App Review Information → Notes)

Pegar en inglés (recomendado para App Review):

```
La Comuna is a supplement-tracking app organized around menstrual cycle phases.
It does NOT require an account. To review all functionality without any setup:

1. On first launch, tap "Explorar con datos de ejemplo" (Explore with sample data)
   on the onboarding screen. This enables a fully offline demo mode with three
   sample profiles: Luna and Mar (cycle tracking on) and Sol (cycle tracking off,
   for people who don't menstruate), plus sample supplements and teas.
2. All tabs work in demo mode: Home (daily check-off), Stock, Meals, Health, Profile.
3. Demo mode persists across launches; it can be turned off from Profile.

Notes:
- The app's normal mode connects to the USER'S OWN Notion workspace using an
  internal integration token the user creates themselves (no OAuth, no backend
  of ours). No credentials are needed for review thanks to demo mode.
- HealthKit: the Health tab reads cycle and wellness data on-device only. On a
  review device/simulator without Health data, the tab will show empty/permission
  states — this is expected. Health data never leaves the device.
- No account creation, no purchases, no ads, no tracking (no ATT prompt).
- Diagnostics (Sentry/PostHog, no health data) can be turned off in Profile →
  "Privacidad y datos". The privacy policy and a medical disclaimer are linked
  in Profile.
- HealthKit writes are opt-in per profile (Profile → Apple Salud): when the user
  checks a supplement as taken, dietary nutrient samples (e.g. magnesium mg)
  from the nutrients the user typed or scanned with iOS Live Text are saved, and
  deleted if unchecked. Sleep is read on-device to show an "energy today" hint.
- Nutrition labels are read with the system "Scan Text" (Live Text) of the text
  field; the app requests no camera permission.
- Non-profit open-source project (GPL-3.0); no in-app donations.
```

**Contacto de review:** nombre, email y teléfono de Diana (se rellenan en el formulario, no aquí).

## Screenshots

Con `supportsTablet: true` en `app.json`, App Store Connect exige **también screenshots de iPad** (13", 2064×2752). Decidir: mantener soporte iPad (y capturar en simulador iPad Pro 13") o quitar `supportsTablet` antes del build para publicar solo iPhone.

Requeridos iPhone: **6.9"** (1320×2868, p. ej. simulador iPhone 17 Pro Max); App Store Connect deriva los tamaños menores si no se suben.

Capturas sugeridas (en modo demo, perfil Luna):

1. Home — tomas del día con fase y día de ciclo visibles
2. Onboarding — pantalla con «Explorar con datos de ejemplo» (transmite «sin cuenta»)
3. Stock — lista con chips de temporada y aviso de recompra
4. Comidas — plan del día
5. Salud — sección de observación (idealmente en un dispositivo con datos reales; si no, omitir)

Cómo: simulador → `Cmd+S` guarda PNG al escritorio en la resolución del dispositivo.

## App Privacy (cuestionario, respuestas propuestas)

Coherentes con [`docs/PRIVACY.md`](../PRIVACY.md). «Collect» para Apple = datos que salen del dispositivo hacia el developer o terceros. Los datos hacia **el Notion de la propia usuaria** (con su token) no son accesibles para nosotras; HealthKit se lee on-device.

**Si el build de producción lleva Sentry + PostHog** (lo esperado; ver paso 2 del flujo):

| Pregunta                                                                                                        | Respuesta                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Do you collect data from this app?                                                                              | **Yes**                                                                                     |
| **Usage Data → Product Interaction** (PostHog: eventos tipo «abrió pestaña Stock», perfil genérico `profile_N`) | Collected. **Not linked** to user's identity. **Not used for tracking**. Purpose: Analytics |
| **Diagnostics → Crash Data** (Sentry: stack traces técnicos)                                                    | Collected. **Not linked**. **Not used for tracking**. Purpose: App Functionality            |
| Health & Fitness                                                                                                | **Not collected** (HealthKit se procesa solo en el dispositivo)                             |
| Identifiers, Contact Info, Location, Financial, etc. (Sentry con `sendDefaultPii: false`: sin IP)               | Not collected                                                                               |
| Tracking (ATT)                                                                                                  | **No** — no hay tracking entre apps ni data brokers                                         |

**Si el build sale sin `SENTRY_DSN` ni `POSTHOG_API_KEY`:** declarar **«Data Not Collected»** en todo.

## Checklist de creación de la app en ASC

1. Crear el App ID / registrar bundle `com.janee.comunaapp` (lo hace EAS automáticamente si ya hubo builds TestFlight)
2. App Store Connect → Apps → nueva app → copiar el **Apple ID numérico** de la app → pegarlo como `ascAppId` en `eas.json` (`submit.production.ios`), junto con `appleId` y `appleTeamId`
3. Rellenar ficha con este documento; subir screenshots
4. Completar App Privacy con la tabla de arriba
5. `npm run eas:build:production` → `npm run eas:submit:production`
6. Seleccionar el build, pegar notas al reviewer, enviar a revisión
