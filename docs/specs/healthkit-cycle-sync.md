# Spec: Ciclo menstrual — HealthKit + SQLite + Notion

**Hooks:** [`src/hooks/useHealthData.ts`](../../src/hooks/useHealthData.ts)  
**API:** [`src/api/healthkit.ts`](../../src/api/healthkit.ts) · Notion: [`src/api/notion.ts`](../../src/api/notion.ts) (`getCurrentPhase`, `updatePhase`)  
**Cálculo de fase:** [`src/utils/phaseCalculator.ts`](../../src/utils/phaseCalculator.ts) (`getCurrentCycleInfo`)  
**Persistencia:** tabla `cycle_states` en [`src/db/schema.ts`](../../src/db/schema.ts)  
**UI:** Perfil (origen del ciclo, reintento Salud) · Inicio/Home (fase y día)

---

## Alcance

- **iOS (dev build):** Tras `requestAuthorization`, leer en Apple Salud las muestras recientes de flujo (`HKCategoryTypeIdentifierMenstrualFlow`; en iOS 18+ también `HKCategoryTypeIdentifierVaginalBleeding` si el SO lo expone) vía `queryCategorySamples` y **inferir el inicio del último episodio** con `derivePeriodStartFromFlowSampleDates` en [`phaseCalculator.ts`](../../src/utils/phaseCalculator.ts): no basta la muestra más reciente (suele ser el último día de sangrado). Se agrupan días civiles locales consecutivos “cerca” (hueco máximo 7 días entre un día con flujo y el siguiente más nuevo del grupo) y `lastPeriodStart` es el **primer día** de ese grupo. Si no hay `queryCategorySamples`, se conserva fallback a `getMostRecentCategorySample`. Persistir `lastPeriodStart` por usuario en SQLite y calcular `cyclePhase` / `cycleDay` con `getCurrentCycleInfo` (ciclo modelo 28 días). El **día del ciclo** usa **días calendario locales** del dispositivo. La fecha **próximo ciclo** en Notion (`updatePhase`) es `YYYY-MM-DD` según ese calendario local; al leerla, `getCurrentPhase` interpreta ISO/DMY como fecha civil local.
- **Web (Expo):** No HealthKit; fase desde Notion si no hay fila en `cycle_states` (`cycleDay: null`).
- **Fase desde HealthKit:** La app **no** lee un tipo “fase actual” de HealthKit en esta versión: Apple no ofrece un único campo equivalente a nuestras cuatro fases de producto; la fase mostrada se **deriva** del último inicio de menstruación/sangrado leíble + reglas en `phaseCalculator`. Una evolución futura podría integrar APIs adicionales de Ciclo menstrual si aportan valor y están disponibles en el SDK.
- **Fallback:** Si no hay dato de Salud o el módulo nativo no está (p. ej. Expo Go), usar último valor en SQLite si existe; si no, fase desde Notion (`cycleDay: null`).

Fuera de alcance: escritura en Salud, background delivery, UI nativa de permisos fuera del sheet del sistema.

---

## Requisitos de entorno (QA)

| Requisito | Descripción |
|-----------|-------------|
| Dev build | Instalar con `npx expo run:ios`. **No** Expo Go. |
| Salud | Dispositivo físico recomendado; datos de menstruación/sangrado en la app Salud. |
| Permisos | Si iOS no muestra de nuevo el sheet: **Ajustes → Salud → Acceso a datos y apps → La Comuna**. |

### Variable opcional: `NOTION_SKIP_PHASE_WRITE` (solo desarrollo)

- Declarada en `.env` (raíz) y tipada en [`src/types/env.d.ts`](../../src/types/env.d.ts). Valores reconocidos como activos (tras `trim` + minúsculas): `true`, `1`, `yes`.
- **Solo aplica si `__DEV__` es verdadero.** En builds de release/production el flag se ignora y `updatePhase` puede ejecutarse con la misma lógica que siempre.
- Cuando está activo, tras la comparación HealthKit vs Notion que dispararía `updatePhase`, el hook **no** llama a `updatePhase` y emite `console.warn` indicando el omitido (útil para probar otro perfil en dispositivo físico sin sobrescribir la fila de fases en Notion).
- Documentación de ejemplo: [`.env.example`](../../.env.example), [README](../../README.md).

---

## Origen de datos (`cycleDataSource`)

| Valor | Significado |
|-------|-------------|
| `healthkit` | Se obtuvo `lastPeriodStart` desde Salud en la última carga exitosa. |
| `sqlite` | Fase/día desde `cycle_states` local; Salud no aportó muestra en esta carga (o aún no se ha sincronizado). |
| `notion` | Sin `lastPeriodStart` local; fase solo desde Notion (`cycleDay` null). |

---

## Flujo de carga (orden)

1. Si hay `lastPeriodStart` en SQLite para el usuario: mostrar fase/día desde ese valor (`cycleDataSource` → `sqlite` hasta que HK confirme).
2. En **iOS:** pedir/leer HealthKit (`getLastMenstruation` → dentro, `initHealthKit` + `requestAuthorization` la primera vez).
3. Si HealthKit devuelve fecha: guardar en SQLite, recalcular fase/día, `cycleDataSource` → `healthkit`.
   - **Solo si HealthKit devolvió una fecha** (no en caso de `null`): **una sola vez por carga** (no en cada render), leer `getCurrentPhase(user)` en Notion para el **usuario seleccionado en la app** y comparar la fase de Notion con la fase derivada de HealthKit, **ambas normalizadas con `normalizePhase`**. Si la celda de Notion no normaliza a una fase de ciclo concreta (`null`) o normaliza a `'all'`, **no** se llama a `updatePhase` (Notion no se altera por este flujo automático). Si ambas son fases comparables y **difieren**, llamar a `updatePhase` **salvo** que `__DEV__` y `NOTION_SKIP_PHASE_WRITE` estén activos (ver sección anterior): en ese caso no se escribe y se registra advertencia en consola. La fecha de próximo ciclo en `updatePhase` es inicio de último período + **28 días civiles locales** vía `addLocalCalendarDays`; **no** se usa la comparación de fechas como disparador de escritura. Fallos de Notion en este paso no bloquean la UI; se registran en consola y PostHog (`health_data_notion_sync_failed`).
4. Si no hay fecha de HK y no había dato local: fase desde Notion (`notion`).

En la **primera instalación** sin SQLite, en iOS se intenta Salud **antes** que Notion para evitar un parpadeo de fase solo-Notion y luego HK.

---

## Criterios de aceptación

| ID | Criterio | Plataforma |
|----|----------|------------|
| HK1 | Tras permitir lectura en Salud y con datos de ciclo, Perfil e Inicio muestran fase coherente y **día del ciclo** cuando aplica. | iOS dev |
| HK2 | Sin permiso o sin datos en Salud, la app no crashea; fase puede venir de Notion o de SQLite previo. | iOS dev |
| HK3 | En Expo Go o sin módulo Nitro/HealthKit, la app arranca; origen no es `healthkit`. | iOS |
| HK4 | Perfil en iOS muestra **origen del ciclo** y estado **HealthKit** (módulo / tienda de salud) para QA. | iOS |
| HK5 | Botón **Reintentar sincronización con Salud** resetea la petición de autorización y vuelve a cargar datos (útil tras cambiar Ajustes). | iOS dev |
| HK6 | Con origen `healthkit` y fecha válida de Salud, la app lee la fila de **ese mismo usuario** en Notion; si la fase en Notion (normalizada) y la fase derivada de HK (normalizada) son fases de ciclo comparables y **difieren**, actualiza vía `updatePhase` **excepto** en `__DEV__` con `NOTION_SKIP_PHASE_WRITE` activo (no escribe, `console.warn`). Si coinciden, si Notion es `null`/`all` tras normalizar, o si no hay muestra de HK, **no** escribe. La fecha de próximo ciclo no dispara la escritura por sí sola. No se dispara en cada render, solo en el flujo de carga del hook. | iOS dev |

---

## Escenarios (Gherkin)

```gherkin
Feature: Sincronización de ciclo con Salud

  Scenario: Primera vez con datos en Salud
    Given la usuaria usa dev build en iOS
    And tiene registros de menstruación en la app Salud
    When abre la app y acepta el acceso a datos de ciclo
    Then el origen del ciclo puede mostrarse como desde Salud
    And ve fase y día del ciclo si el cálculo aplica

  Scenario: Sin datos en Salud
    Given no hay muestras de menstruación/sangrado leíbles
    When carga Perfil
    Then la fase puede venir de Notion o de datos locales previos
    And la app no muestra error bloqueante por HealthKit

  Scenario: Reintento tras Ajustes
    Given la usuaria activó permisos en Ajustes > Salud
    When pulsa Reintentar sincronización con Salud en Perfil
    Then se vuelve a solicitar flujo de autorización o lectura
    And los datos se refrescan
```

---

## Checklist QA manual (iPhone, dev build)

- [ ] Instalar con `npx expo run:ios` (no Expo Go).
- [ ] Perfil: comprobar línea de **origen del ciclo** y **Estado HealthKit**.
- [ ] Con datos en Salud y permiso: origen **Salud (HealthKit)** y día de ciclo visible si aplica.
- [ ] Sin permiso: app usable; activar en Ajustes → Salud → La Comuna → datos de menstruación.
- [ ] Pulsar **Reintentar sincronización con Salud** y verificar actualización.
- [ ] Cambiar usuario Diana/Estefanía: cada uno mantiene su fila en `cycle_states`.
- [ ] En Xcode consola (dev): tras sync OK, log `[useHealthData] Último inicio de menstruación (HealthKit): … → fase … día …`.

---

## Referencias

- Librería: `@kingstinct/react-native-healthkit` + `react-native-nitro-modules`.
- Eventos PostHog: ver [`posthog-analytics.md`](./posthog-analytics.md).
