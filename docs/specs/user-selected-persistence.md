# Spec: Persistencia del usuario seleccionado (AsyncStorage)

**Implementación:** [`App.tsx`](../../App.tsx), [`src/context/UserContext.tsx`](../../src/context/UserContext.tsx), [`src/screens/Profile.tsx`](../../src/screens/Profile.tsx), [`src/screens/Home.tsx`](../../src/screens/Home.tsx)  
**Dependencia:** `@react-native-async-storage/async-storage`  
**Analítica:** [`docs/specs/posthog-analytics.md`](posthog-analytics.md) (eventos de usuario / picker)

---

## Alcance

- Clave AsyncStorage: `selected_user`; valores válidos: `profile_1` | `profile_2` (migración automática desde `diana`/`estefania` legacy).
- Tras migraciones SQLite OK: leer almacenamiento; si hay valor válido, restaurar contexto y mostrar pestañas; si no, pantalla solo selector (sin tab bar).
- Cualquier cambio de usuario activo (selector en Perfil) persiste en AsyncStorage.
- Acción «Cambiar usuario» en Perfil: borra la clave y vuelve a la pantalla de selector.

### Persistencia de emoji por usuario (UI)

- Claves AsyncStorage:
  - `user_emoji_profile_1`
  - `user_emoji_profile_2`
- Emoji permitido (picker predefinido): `🌿 🌸 🦋 🌙 ✨ 🔮 🌺 🍄 🌊 🦅`
- Valor por defecto cuando no se elige (o si no hay clave guardada): `🌿`
- Persistencia: al completar la selección inicial de usuario (pantalla gate de `App.tsx`) se guarda el emoji correspondiente al usuario elegido.
- Hidratación desde AsyncStorage al abrir el gate no debe **reemplazar** un emoji que la usuaria ya haya tocado en el picker antes de que termine la lectura (evitar condición de carrera).
- El reset de flags «emoji tocado» y la lectura inicial desde AsyncStorage ocurren **solo en la transición** gate cerrado → abierto; no en cada re-ejecución del efecto (p. ej. si cambia `success` de migraciones mientras el gate sigue abierto), para no perder selecciones en curso.
- Presentación: en `Home` (header) se muestra `${emoji} ${label}` donde el label viene de `getProfileLabel()` (`src/config/profiles.ts`; overrides en `profiles.local.ts`).

Fuera de alcance: React Navigation, lógica de hooks (`useHealthData`, etc.), datos Notion.

---

## Criterios de aceptación

| ID      | Criterio                                                                                                                                                                                                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USP-1   | Sin valor guardado (o valor inválido), tras arranque la app muestra solo el selector de perfiles (sin pestañas).                                                                                                                                                                                                                               |
| USP-2   | Tras elegir perfil en esa pantalla, se intenta guardar `selected_user` (y emoji) en AsyncStorage, se cierra el gate, se muestran las pestañas y la pestaña activa puede volver a Inicio. Si la escritura falla, la app entra igual en pestañas con el perfil elegido en sesión (sin bloquear en el selector); el error se registra en Sentry.  |
| USP-3   | Con valor válido guardado, al siguiente cold start la app abre directamente en las pestañas con ese perfil (sin pantalla de selector).                                                                                                                                                                                                         |
| USP-4   | En Perfil, cambiar entre perfiles actualiza `selected_user` y tras reinicio persiste el último elegido.                                                                                                                                                                                                                                        |
| USP-5   | «Cambiar usuario» elimina `selected_user` y muestra de nuevo la pantalla de selector; hasta elegir de nuevo no se reescribe la clave. Si `removeItem` falla, igual se muestra el selector (y se registra el error) para que la usuaria no quede sin respuesta.                                                                                 |
| USP-6   | Si la app se cierra estando en el selector tras USP-5, el próximo arranque vuelve a mostrar el selector (no hay clave).                                                                                                                                                                                                                        |
| USP-7   | `PostHogIdentifyUser` no corre mientras la pantalla de selector está visible (sin identificar con perfil por defecto antes de elegir).                                                                                                                                                                                                         |
| USP-8   | En la pantalla de selector (gate), debajo de cada botón se muestra un picker de emojis predefinidos; la selección por defecto es `🌿`.                                                                                                                                                                                                         |
| USP-9   | Al completar la selección inicial de usuario `u`, se persiste `user_emoji_u` con el emoji seleccionado para ese `u` (si no se eligió, se persiste `🌿`).                                                                                                                                                                                       |
| USP-10  | En `Home`, el header del checklist muestra el emoji leído desde `AsyncStorage.getItem(user_emoji_${user})` y si falta/está vacío muestra `🌿` en vez de romper la UI.                                                                                                                                                                          |
| USP-11  | En `Perfil`, desde el selector de usuario se puede cambiar el emoji de cada perfil; al cambiar se persiste en su clave `user_emoji_u` sin necesidad de volver al gate inicial.                                                                                                                                                                 |
| USP-12  | Si la usuaria elige un emoji en el gate antes de que termine `AsyncStorage.getItem` para los emojis guardados, esa elección se conserva (no la pisa la hidratación tardía).                                                                                                                                                                    |
| USP-12b | Con el gate abierto, una nueva ejecución del efecto de hidratación de emojis (p. ej. por cambio de `success` en migraciones) **no** resetea los emojis ya elegidos en pantalla ni vuelve a disparar la lectura como si el gate acabara de abrirse.                                                                                             |
| USP-13  | Cambios rápidos de usuario en Perfil: el usuario activo en UI se actualiza de forma **síncrona**; las escrituras a `AsyncStorage` no pueden dejar un perfil antiguo en pantalla por completarse fuera de orden. Si falla la persistencia del último cambio intentado, se revierte al valor anterior solo si la UI sigue mostrando ese intento. |
| USP-14  | Tras «Cambiar usuario», si falla `AsyncStorage.removeItem`, la app muestra igual el gate (selector); no solo PostHog — coherente con el arranque cuando falla la lectura de `selected_user`.                                                                                                                                                   |

---

## Escenarios (Gherkin)

```gherkin
Feature: Usuario persistido

  Scenario: Primera vez sin almacenamiento
    Given no existe clave selected_user
    When la app termina de cargar la base local
    Then se muestra la pantalla de selección de usuario
    And no se muestra la barra de pestañas

  Scenario: Elegir usuario inicial
    Given se muestra la pantalla de selección de usuario
    When la usuaria elige "Estefanía"
    Then selected_user es "estefania"
    And se muestran las pestañas con Estefanía activa

  Scenario: Arranque con usuario guardado
    Given selected_user es "diana"
    When la app termina de cargar la base local
    Then se muestran las pestañas directamente
    And el usuario activo es Diana

  Scenario: Cambiar usuario desde Perfil
    Given la usuaria está en Perfil con Diana activa
    When pulsa "Cambiar usuario"
    Then selected_user ya no existe
    And se muestra la pantalla de selección de usuario

  Scenario: Guardar emoji para el usuario inicial
    Given se muestra la pantalla de selección de usuario
    When la usuaria elige "Diana" con emoji "🌸"
    Then user_emoji_diana es "🌸"
    And selected_user es "diana"

  Scenario: Header del checklist usa emoji guardado
    Given selected_user es "estefania"
    And user_emoji_estefania es "🦋"
    When la app termina de cargar
    Then el header del checklist muestra "🦋 Estefanía"
```

---

## Analítica (PostHog)

Los nombres y propiedades están definidos en la tabla de eventos explícitos en [`posthog-analytics.md`](posthog-analytics.md). Resumen:

| Evento                     | Uso en este feature                                                    |
| -------------------------- | ---------------------------------------------------------------------- |
| `selected_user_restored`   | Hidratación cold start con valor válido                                |
| `user_picker_shown`        | Se muestra el selector (`reason`: `no_stored_value` \| `manual_clear`) |
| `user_picker_completed`    | Elección en la pantalla de selector de `App`                           |
| `user_switched_in_profile` | Cambio Diana/Estefanía en Perfil (solo si el perfil cambia)            |
| `stored_user_cleared`      | Tras borrar almacenamiento al pulsar «Cambiar usuario»                 |
| `user_persistence_failed`  | Error en lectura/escritura/borrado de AsyncStorage                     |

---

## Desarrollo iOS: `NativeModule: AsyncStorage is null`

El QR de `expo start` solo descarga **JavaScript**. `@react-native-async-storage/async-storage` añade **código nativo**; la app instalada en el iPhone/simulador debe haberse **compilada de nuevo** después de instalar el paquete.

1. En la raíz del repo: `npx pod-install` (o `cd ios && pod install`).
2. Recompilar e instalar el **development build** (no basta con prebuild si no reinstalas la app): `npx expo run:ios` (elige dispositivo o simulador).
3. Abrir el proyecto con **esa** build (icono “La Comuna” / dev client), luego escanear el QR o usar el enlace del Metro de ese mismo `expo start`.

Si sigues usando una `.ipa` o build anterior hecha **antes** de añadir AsyncStorage, el módulo nativo no existirá en el binario y aparecerá este error aunque `prebuild` haya sido exitoso.
