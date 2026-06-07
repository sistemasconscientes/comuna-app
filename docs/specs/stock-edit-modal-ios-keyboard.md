# Spec: Modal de edición de stock (teclado en iOS)

**Pantalla:** `Stock` — `[src/screens/Stock.tsx]`  
**Problema resuelto:** En iPhone el teclado tapaba los campos y tocar fuera del sheet cerraba el modal perdiendo la configuración.

---

## Alcance

- Modal transparente al abrir un suplemento desde la lista de Stock.
- Campos: fecha de apertura (YYYY-MM-DD), total de pastillas, pastillas por día.
- Acciones: Abrí frasco nuevo, Cancelar, Guardar.

Fuera de alcance de este spec: validación de negocio de `updateBottle`, sincronización Notion, cálculo de días restantes.

---

## Historias de usuario

1. **Como** usuaria **quiero** ver y editar todos los campos del stock con el teclado abierto **para** completar los datos sin que el teclado los tape.
2. **Como** usuaria **quiero** tocar fuera del formulario para cerrar solo el teclado **para** seguir en la misma configuración del suplemento.
3. **Como** usuaria **quiero** tocar fuera (con teclado cerrado) o Cancelar **para** salir del modal sin guardar.

---

## Criterios de aceptación

| ID  | Criterio                                                                                                                                   | Plataforma |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AC1 | Con el teclado visible, el contenido del modal puede desplazarse verticalmente hasta que el campo enfocado y los botones sean alcanzables. | iOS        |
| AC2 | Con el teclado visible, al tocar el área oscura (backdrop) **no** se cierra el modal; el teclado se oculta y el modal permanece abierto.   | iOS        |
| AC3 | Con el teclado **no** visible, al tocar el backdrop se cierra el modal (mismo efecto que salir de la edición).                             | iOS        |
| AC4 | Los taps en botones y `TextInput` dentro del sheet funcionan con teclado abierto (no se pierden taps por el scroll).                       | iOS        |
| AC5 | Cancelar y Guardar cierran el modal según reglas ya existentes (Guardar tras persistir válido).                                            | iOS        |

---

## Escenarios (Gherkin)

```gherkin
Feature: Edición de stock en modal con teclado en iOS

  Background:
    Given el usuario está en la pantalla Stock
    And hay al menos un suplemento sincronizado en DB local
    When el usuario abre la edición de stock de ese suplemento
    Then el modal de configuración está visible

  Scenario: Teclado no cierra el modal al tocar fuera
    Given el modal de stock está abierto
    And el teclado está visible (campo numérico o fecha enfocado)
    When el usuario toca el fondo oscuro fuera del sheet blanco
    Then el teclado se oculta
    And el modal sigue visible
    And los valores editados en los campos se mantienen

  Scenario: Cerrar modal desde backdrop sin teclado
    Given el modal de stock está abierto
    And el teclado no está visible
    When el usuario toca el fondo oscuro fuera del sheet
    Then el modal se cierra

  Scenario: Acceso a campos inferiores con teclado abierto
    Given el modal de stock está abierto
    When el usuario enfoca "Pastillas por día" o un campo inferior
    Then puede desplazar el contenido hasta ver el campo activo y acciones
    And puede pulsar Guardar o Cancelar sin quedar tapado por el teclado

  Scenario: Cancelar explícito
    Given el modal de stock está abierto
    When el usuario pulsa Cancelar
    Then el modal se cierra
```

---

## Checklist QA manual (iPhone)

- [ ] Abrir Stock → tocar un ítem → modal visible.
- [ ] Enfocar "Total de pastillas" → teclado aparece → scroll hasta "Pastillas por día" y botones.
- [ ] Con teclado abierto, tocar backdrop → teclado baja, modal **sigue** abierto.
- [ ] Sin teclado, tocar backdrop → modal **cierra**.
- [ ] Guardar con datos válidos → cierra y persiste (comportamiento previo).
- [ ] Cancelar → cierra sin exigir guardar.

---

## Notas de implementación (referencia)

- Estado `keyboardVisible` vía `Keyboard.addListener('keyboardDidShow' | 'keyboardDidHide')`.
- Backdrop: si `keyboardVisible` → `Keyboard.dismiss()`; si no → `setEditState(null)`.
- Sheet: `KeyboardAvoidingView` (iOS `padding`) + `ScrollView` con `keyboardShouldPersistTaps="handled"`, `maxHeight` ~85% para permitir scroll.

---

## Regresión

- Lista de suplementos y badge de días no deben cambiar de comportamiento.
- Alert "Sin datos locales" al abrir ítem no sincronizado sigue igual.
