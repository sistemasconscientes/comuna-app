# Perfiles múltiples y ciclo opcional

## Objetivo

La app sirve a un hogar completo (pareja, familia, roomies): **1 a 8 perfiles** por teléfono, y cada perfil decide si **sigue ciclo menstrual**. Quien no menstrúa ve sus suplementos sin fases y la app no lee su ciclo en Apple Salud.

## Modelo (`src/config/profiles.ts`)

- `ProfileId = profile_${n}`, posicional (1…`MAX_PROFILES` = 8). Los ids son claves en SQLite (`daily_logs.user`, `cycle_states.user`) y en AsyncStorage (`user_emoji_<id>`, `selected_user`), así que **no se renumeran**: solo se agrega o quita el **último** perfil (`addProfile` / `removeLastProfile`). Los registros locales de un perfil quitado se conservan.
- La cantidad vive en `ProfileOverrides.profileCount` (default `DEFAULT_PROFILE_COUNT` = 2). `getProfiles()` deriva los slots; `profileIdsRecord` itera sobre ellos.
- `cycleByProfile[id] = false` marca un perfil sin ciclo; `profileTracksCycle(id)` es `true` por defecto.
- Prioridad de overrides: `profiles.local.ts` > runtime (AsyncStorage `profile_overrides_v1`) > defaults. Quien edite overrides debe conservar el resto (`...prev`), o se pierden `profileCount` y `cycleByProfile`.
- Personas compartidas: `SHARED_PERSONA_VALUES` (`Compartido`, `Ambas`, `Todas`, `Todos`), comparadas con `isSharedPersona()` (sin importar mayúsculas). `getSupplements` filtra por la persona del perfil **o** cualquier valor compartido.

## Detección en el onboarding (`discoverNotionTemplate` / `verifyManualNotionIds`)

1. Filas de la tabla inline de la página de Fases → perfiles **con ciclo**, salvo que la columna Fase diga «Sin ciclo», «No aplica», «N/A» o «No menstrúa» (`isNoCyclePhaseText`) → **sin ciclo**.
2. Opciones del select **Persona** de la DB de Suplementos que no tienen fila en la tabla (y que no son compartidas ni palabras de encabezado) → perfiles **sin ciclo**, después de los anteriores.
3. Una página candidata **por título** puede tener la tabla vacía (hogar donde nadie sigue ciclo); el barrido ciego de otras páginas exige al menos una fila.
4. `overridesFromDetectedPersonas(cycle, noCycle)` deduplica, recorta a `MAX_PROFILES` y fija `profileCount`.

## Comportamiento de un perfil sin ciclo

- `useHealthData`: no consulta HealthKit ni la tabla de fases; devuelve fase `null` y `tracksCycle: false`. Reacciona al switch de Perfil vía `subscribeProfileOverrides`.
- Inicio: oculta la pastilla y la barra de fase; muestra todos los tés «en casa» (`getTeasForPhase(null)`); los suplementos pasan por el filtro de Temporada con fase vacía (entran «Todo el año» y el trimestre actual, no las etiquetas de fase).
- Perfil: oculta la tarjeta de fase y los avisos de contexto de HealthKit.
- No se escribe nada en la tabla de fases de Notion.

## Comidas

`dishColumnIndex`: tablas con 3+ columnas tienen una columna de plato por perfil, en orden; un perfil sin columna propia usa la 1.

## Stock compartido

`usesSharedStockBackend(persona)` = persona compartida **y** backend configurado (`EXPO_PUBLIC_BACKEND_URL` + `BACKEND_API_KEY`). Sin backend (el build de App Store), el stock compartido vive en SQLite local como cualquier otro.

## UI

- Gate «¿Quién usa la app?»: lista vertical con scroll (emoji + nombre); los emojis van en una fila horizontal por perfil.
- Perfil → «Perfiles en este teléfono»: una fila por perfil (tocar = activar) con panel «Editar» (emoji, nombre en la app, persona en Notion, switch «Sigue ciclo menstrual»), más «+ Agregar perfil» y «Quitar último…».

## Demo

Luna y Mar (con ciclo) y Sol (sin ciclo, con su propio suplemento). Persona compartida = `Compartido`.
