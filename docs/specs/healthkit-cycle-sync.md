# Spec: Ciclo menstrual — HealthKit + SQLite + Notion

**Hooks:** [`src/hooks/useHealthData.ts`](../../src/hooks/useHealthData.ts)  
**API:** [`src/api/healthkit.ts`](../../src/api/healthkit.ts) · Notion: [`src/api/notion.ts`](../../src/api/notion.ts) (`getCurrentPhase`, `updatePhase`)  
**Cálculo de fase:** [`src/utils/phaseCalculator.ts`](../../src/utils/phaseCalculator.ts) (`getCurrentCycleInfo`, `getCurrentCycleInfoWithHealthKitRefinements`, `inferBbtRiseAnchorFromSamples`)  
**Persistencia:** tabla `cycle_states` en [`src/db/schema.ts`](../../src/db/schema.ts)  
**UI:** Perfil (avisos Salud irregular/embarazo/lactancia/anticonceptivo, origen del ciclo QA, reintento Salud) · Inicio/Home (fase y día) · pestaña **Salud** (valores HealthKit legibles; ver [`healthkit-data-screen.md`](./healthkit-data-screen.md))

---

## Alcance

- **iOS (dev build):** Tras `requestAuthorization`, se piden lecturas que el SO declare disponibles (`areObjectTypesAvailableAsync`), entre otras: flujo menstrual, **sangrado intermenstrual**, **test de ovulación**, **moco cervical**, **temperatura basal**, **test de embarazo**, **lactancia**, **anticonceptivo**, y categorías iOS 16+ de **ciclo irregular**. **No** se usa `HKCategoryTypeIdentifierVaginalBleeding` con la versión actual de `@kingstinct/react-native-healthkit` (no está en el enum nativo del bridge). Ver `buildReadTypes` y `fetchHealthKitCycleSignals` en [`src/api/healthkit.ts`](../../src/api/healthkit.ts).
- **`lastPeriodStart`:** (1) Si hay muestras de flujo con `HKMenstrualCycleStart` / `metadataMenstrualCycleStart`, se usa el inicio de ciclo **más reciente** (medianoche local de ese día). (2) Si no, `derivePeriodStartFromFlowSampleDates` sobre fechas de flujo **filtradas**: se omite un día con flujo solo ligero/indefinido si ese día civil tiene sangrado intermenstrual y no está marcado como inicio de ciclo. Fallback: `getMostRecentCategorySample` (flujo menstrual). Persistencia en SQLite y **día del ciclo** en días civiles locales; próximo ciclo en Notion en `YYYY-MM-DD` local vía `addLocalCalendarDays`.
- **Refinado de fase:** Tras el modelo 28 días, `getCurrentCycleInfoWithHealthKitRefinements` puede forzar `ovulacion` (pico LH/estrógeno o moco aguado/clara de huevo en ventana de 3 días civiles) o `lutea` (subida BBT heurística en `inferBbtRiseAnchorFromSamples`, ventana de 10 días tras el ancla).
- **Banderas:** `HealthData.healthKitIrregularCycleHint` y `healthKitLifecycleContext` (`none` \| `pregnancy` \| `lactation` \| `contraceptive`) según muestras recientes (ventanas: test embarazo positivo 270 días, lactancia 120 días, anticonceptivo 90 días, irregular 365 días). Con **embarazo o lactancia** no se ejecuta `updatePhase` automático desde Salud.
- **Web (Expo):** Sin HealthKit; fase desde Notion o SQLite; banderas HK en `false` / `none`.
- **Fase:** No existe tipo único “fase actual” en Apple; todo es **derivado** (modelo + señales).
- **Fallback:** Sin Salud o sin módulo (Expo Go): SQLite si hay; si no, Notion (`cycleDay` null).

Fuera de alcance: escritura en Salud, background delivery, UI nativa de permisos fuera del sheet del sistema.

---

## Requisitos de entorno (QA)

| Requisito | Descripción                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| Dev build | Instalar con `npx expo run:ios`. **No** Expo Go.                                              |
| Salud     | Dispositivo físico recomendado; datos de menstruación/sangrado en la app Salud.               |
| Permisos  | Si iOS no muestra de nuevo el sheet: **Ajustes → Salud → Acceso a datos y apps → La Comuna**. |

**Permisos y consola (dev):** iOS suele agrupar datos de **ciclo menstrual** en un solo ámbito en Ajustes; no es obligatorio ver un interruptor distinto por cada tipo HK. Mientras un tipo concreto siga en estado _not determined_ o sin lectura concedida, `queryCategorySamples` puede devolver `Authorization not determined` (code 5): es **esperable** hasta que la usuaria conceda acceso o active lecturas detalladas para la app. En `__DEV__` la app **no** registra en consola esos errores benignos de permiso (sí los errores inesperados).

### Variable opcional: `NOTION_SKIP_PHASE_WRITE` (solo desarrollo)

- Declarada en `.env` (raíz) y tipada en [`src/types/env.d.ts`](../../src/types/env.d.ts). Valores reconocidos como activos (tras `trim` + minúsculas): `true`, `1`, `yes`.
- **Solo aplica si `__DEV__` es verdadero.** En builds de release/production el flag se ignora y `updatePhase` puede ejecutarse con la misma lógica que siempre.
- Cuando está activo, tras la comparación HealthKit vs Notion que dispararía `updatePhase`, el hook **no** llama a `updatePhase` y emite `console.warn` indicando el omitido (útil para probar otro perfil en dispositivo físico sin sobrescribir la fila de fases en Notion).
- Documentación de ejemplo: [`.env.example`](../../.env.example), [README](../../README.md).

---

## Origen de datos (`cycleDataSource`)

| Valor       | Significado                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `healthkit` | Se obtuvo `lastPeriodStart` desde Salud en la última carga exitosa.                                       |
| `sqlite`    | Fase/día desde `cycle_states` local; Salud no aportó muestra en esta carga (o aún no se ha sincronizado). |
| `notion`    | Sin `lastPeriodStart` local; fase solo desde Notion (`cycleDay` null).                                    |

---

## Flujo de carga (orden)

1. En **iOS:** `getHealthKitDiagnostics` + `fetchHealthKitCycleSignals` (dentro: `initHealthKit` + `requestAuthorization` la primera vez). Una sola lectura consolidada sustituye al antiguo `getLastMenstruation` aislado.
2. **Origen de `lastPeriodStart`:** Si `signals.lastPeriodStart` existe → persistir en SQLite, `cycleDataSource` → `healthkit`. Si no, si hay fila en `cycle_states` → usar esa fecha, `sqlite`. Si no → fase solo Notion (`notion`, `cycleDay` null).
3. **Fase/día mostrados:** `getCurrentCycleInfoWithHealthKitRefinements(lastPeriodStart, refinements)` con las señales de ovulación/moco/BBT de `fetchHealthKitCycleSignals`. Las banderas `healthKitIrregularCycleHint` y `healthKitLifecycleContext` se rellenan siempre que iOS haya devuelto señales (aunque el origen sea `sqlite` o `notion`).
4. **Escritura Notion:** **Solo** si `cycleDataSource === 'healthkit'` y `lifecycleContext` **no** es `pregnancy` ni `lactation`: una vez por carga, comparar fase Notion vs fase refinada (normalizadas); si difieren y son comparables, `updatePhase` salvo `NOTION_SKIP_PHASE_WRITE` en dev. Misma regla de próximo ciclo (+28 días civiles locales). Fallos → Sentry / dominio `health_data`.

En la **primera instalación** sin SQLite, en iOS Salud sigue teniendo prioridad sobre Notion para la fecha de último período.

---

## Criterios de aceptación

| ID  | Criterio                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Plataforma |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| HK1 | Tras permitir lectura en Salud y con datos de ciclo, Perfil e Inicio muestran fase coherente y **día del ciclo** cuando aplica.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | iOS dev    |
| HK2 | Sin permiso o sin datos en Salud, la app no crashea; fase puede venir de Notion o de SQLite previo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | iOS dev    |
| HK3 | En Expo Go o sin módulo Nitro/HealthKit, la app arranca; origen no es `healthkit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | iOS        |
| HK4 | Perfil en iOS muestra **origen del ciclo** y estado **HealthKit** (módulo / tienda de salud) para QA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | iOS        |
| HK5 | Botón **Reintentar sincronización con Salud** resetea la petición de autorización y vuelve a cargar datos (útil tras cambiar Ajustes).                                                                                                                                                                                                                                                                                                                                                                                                                                                       | iOS dev    |
| HK6 | Con origen `healthkit` y fecha válida de Salud, la app lee la fila de **ese mismo usuario** en Notion; si la fase en Notion (normalizada) y la fase derivada de HK (normalizada) son fases de ciclo comparables y **difieren**, actualiza vía `updatePhase` **excepto** en `__DEV__` con `NOTION_SKIP_PHASE_WRITE` activo (no escribe, `console.warn`). Si coinciden, si Notion es `null`/`all` tras normalizar, o si no hay muestra de HK, **no** escribe. La fecha de próximo ciclo no dispara la escritura por sí sola. No se dispara en cada render, solo en el flujo de carga del hook. | iOS dev    |
| HK7 | Si `healthKitLifecycleContext` es `pregnancy` o `lactation`, **no** se llama a `updatePhase` en ese flujo aunque el origen sea `healthkit`. Perfil puede mostrar aviso (irregular / embarazo / lactancia / anticonceptivo).                                                                                                                                                                                                                                                                                                                                                                  | iOS dev    |

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

- Librería: `@kingstinct/react-native-healthkit` + `react-native-nitro-modules`. API pública de ciclo: `fetchHealthKitCycleSignals`, `getLastMenstruation` (compat: solo `lastPeriodStart`).
- Eventos PostHog: ver [`posthog-analytics.md`](./posthog-analytics.md).
