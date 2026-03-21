# Spec: UI pantalla Inicio (referencia visual)

**Implementación:** [`src/screens/Home.tsx`](../../src/screens/Home.tsx), [`App.tsx`](../../App.tsx) (fondo / barra de pestañas), [`src/components/EnergyChart.tsx`](../../src/components/EnergyChart.tsx) (tarjeta del gráfico)

---

## Alcance

Alineación visual con referencia de producto: paleta cálida (fondo crema/beige), acento terracota (`#C97B6E`), tipografía clara, cabecera con emoji + nombre, fecha del día, pastilla de fase, acceso a ajustes (Perfil), lista de suplementos en tarjeta blanca con separadores y checkboxes circulares.

---

## Criterios de aceptación

| ID | Criterio |
|----|----------|
| UI-1 | Fondo de pantalla Inicio: tono crema/beige (p. ej. `#F5F0E8`), no gris plano `#FAFAFA` solo en esta pantalla o coherente con `App` cuando hay pestañas. |
| UI-2 | Cabecera superior: fila con bloque izquierdo (emoji + nombre en línea, fecha debajo en gris) y botón circular/outline de ajustes a la derecha que navega a Perfil (`onOpenSettings`). |
| UI-3 | Debajo de la fecha: pastilla de fase con fondo rosado muy suave, punto terracota y texto de fase legible (sin tarjeta grande centrada duplicada si la info ya está en la pastilla). |
| UI-4 | Lista del día: contenedor tipo tarjeta blanca, esquinas muy redondeadas, filas separadas por línea sutil; checkbox circular; al marcar: relleno terracota y marca ✓ blanca. |
| UI-5 | Barra de pestañas: pestaña activa con fondo terracota y texto claro; inactivas sobre fondo crema/beige coherente con la referencia. |

---

## Fuera de alcance

- Cambiar datos o lógica de `useHealthData` / `useSupplements` / `useDailyLog`.
- Añadir librerías de iconos; se usa carácter Unicode para engranaje si aplica.
