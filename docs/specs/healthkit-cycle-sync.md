# Spec: Ciclo menstrual — HealthKit + SQLite + Notion

**Hooks:** [`src/hooks/useHealthData.ts`](../../src/hooks/useHealthData.ts)  
**API:** [`src/api/healthkit.ts`](../../src/api/healthkit.ts) · Notion: [`src/api/notion.ts`](../../src/api/notion.ts) (`getCurrentPhase`, `updatePhase`)  
**Cálculo de fase:** [`src/utils/phaseCalculator.ts`](../../src/utils/phaseCalculator.ts) (`getCurrentCycleInfo`)  
**Persistencia:** tabla `cycle_states` en [`src/db/schema.ts`](../../src/db/schema.ts)  
**UI:** Perfil (origen del ciclo, reintento Salud) · Inicio/Home (fase y día)

---

## Alcance

- **iOS (dev build):** Tras `requestAuthorization`, leer en Apple Salud la fecha de inicio de la muestra de categoría más reciente (`HKCategoryTypeIdentifierMenstrualFlow`; en iOS 18+ también `HKCategoryTypeIdentifierVaginalBleeding` si el SO lo expone). Persistir `lastPeriodStart` por usuario en SQLite y calcular `cyclePhase` / `cycleDay` con `getCurrentCycleInfo` (ciclo modelo 28 días; ver `phaseCalculator.ts`).
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
   - Tras eso, **una sola vez por carga** (no en cada render): leer `getCurrentPhase(user)` en Notion y comparar con la fase derivada de HealthKit y con la fecha de **próximo ciclo** esperada (`lastPeriodStart` + `DEFAULT_CYCLE_LENGTH_DAYS`, mismo modelo que el cálculo de fase). Si la fase normalizada o la fecha (día UTC `YYYY-MM-DD`) difieren, llamar a `updatePhase` para alinear la tabla inline en Notion. Fallos de Notion en este paso no bloquean la UI; se registran en consola y PostHog (`health_data_notion_sync_failed`).
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
| HK6 | Con origen `healthkit`, si Notion tiene otra fase (normalizada) u otra fecha de próximo ciclo (mismo criterio UTC día), la app actualiza la fila del usuario en Notion vía `updatePhase`; si ya coinciden, **no** escribe. No se dispara en cada render, solo en el flujo de carga del hook. | iOS dev |

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
