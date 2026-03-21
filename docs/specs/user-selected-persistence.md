# Spec: Persistencia del usuario seleccionado (AsyncStorage)

**Implementación:** [`App.tsx`](../../App.tsx), [`src/context/UserContext.tsx`](../../src/context/UserContext.tsx), [`src/screens/Profile.tsx`](../../src/screens/Profile.tsx)  
**Dependencia:** `@react-native-async-storage/async-storage`  
**Analítica:** [`docs/specs/posthog-analytics.md`](posthog-analytics.md) (eventos de usuario / picker)

---

## Alcance

- Clave AsyncStorage: `selected_user`; valores válidos: `diana` | `estefania`.
- Tras migraciones SQLite OK: leer almacenamiento; si hay valor válido, restaurar contexto y mostrar pestañas; si no, pantalla solo selector (sin tab bar).
- Cualquier cambio de usuario activo (selector en Perfil) persiste en AsyncStorage.
- Acción «Cambiar usuario» en Perfil: borra la clave y vuelve a la pantalla de selector.

Fuera de alcance: React Navigation, lógica de hooks (`useHealthData`, etc.), datos Notion.

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| USP-1 | Sin valor guardado (o valor inválido), tras arranque la app muestra solo el selector Diana/Estefanía (sin pestañas). |
| USP-2 | Tras elegir usuario en esa pantalla, se guarda `selected_user`, se muestran las pestañas y la pestaña activa puede volver a Inicio. |
| USP-3 | Con valor válido guardado, al siguiente cold start la app abre directamente en las pestañas con ese usuario (sin pantalla de selector). |
| USP-4 | En Perfil, cambiar entre Diana y Estefanía actualiza `selected_user` y tras reinicio persiste el último elegido. |
| USP-5 | «Cambiar usuario» elimina `selected_user` y muestra de nuevo la pantalla de selector; hasta elegir de nuevo no se reescribe la clave. |
| USP-6 | Si la app se cierra estando en el selector tras USP-5, el próximo arranque vuelve a mostrar el selector (no hay clave). |
| USP-7 | `PostHogIdentifyUser` no corre mientras la pantalla de selector está visible (sin identificar con perfil por defecto antes de elegir). |

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
```

---

## Analítica (PostHog)

Los nombres y propiedades están definidos en la tabla de eventos explícitos en [`posthog-analytics.md`](posthog-analytics.md). Resumen:

| Evento | Uso en este feature |
|--------|---------------------|
| `selected_user_restored` | Hidratación cold start con valor válido |
| `user_picker_shown` | Se muestra el selector (`reason`: `no_stored_value` \| `manual_clear`) |
| `user_picker_completed` | Elección en la pantalla de selector de `App` |
| `user_switched_in_profile` | Cambio Diana/Estefanía en Perfil (solo si el perfil cambia) |
| `stored_user_cleared` | Tras borrar almacenamiento al pulsar «Cambiar usuario» |
| `user_persistence_failed` | Error en lectura/escritura/borrado de AsyncStorage |

---

## Desarrollo iOS: `NativeModule: AsyncStorage is null`

El QR de `expo start` solo descarga **JavaScript**. `@react-native-async-storage/async-storage` añade **código nativo**; la app instalada en el iPhone/simulador debe haberse **compilada de nuevo** después de instalar el paquete.

1. En la raíz del repo: `npx pod-install` (o `cd ios && pod install`).
2. Recompilar e instalar el **development build** (no basta con prebuild si no reinstalas la app): `npx expo run:ios` (elige dispositivo o simulador).
3. Abrir el proyecto con **esa** build (icono “La Comuna” / dev client), luego escanear el QR o usar el enlace del Metro de ese mismo `expo start`.

Si sigues usando una `.ipa` o build anterior hecha **antes** de añadir AsyncStorage, el módulo nativo no existirá en el binario y aparecerá este error aunque `prebuild` haya sido exitoso.
