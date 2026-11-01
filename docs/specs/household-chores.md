# Tareas del hogar (pestaña Casa)

## Objetivo

Una lista de tareas de casa por día, con la misma lógica que los suplementos: la fuente es una base de Notion con frecuencia y persona asignada, y la app muestra y deja marcar lo que toca hoy. El «hecho» se comparte entre los teléfonos del hogar.

## Notion: base «Tareas del hogar» (opcional)

Se detecta por título (una palabra que empieza por «Tarea», `matchNotionTemplate.choresDbId`). Propiedades (`CHORE_PROPS` en `src/api/notion.ts`):

| Propiedad     | Tipo         | Uso                                                                                                                                            |
| ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| (título)      | Título       | Nombre de la tarea (cualquier nombre de propiedad).                                                                                            |
| `Frecuencia`  | Select       | `Diaria`, `Semanal`, `Cada 2 semanas` / `Quincenal`, `Mensual`, `Cada N días`. Si no se reconoce, se trata como semanal (visible, no perdida). |
| `Cada (días)` | Número       | Solo para «Cada N días». También vale «Cada 3 días» escrito en el select.                                                                      |
| `Días`        | Multi-select | Días fijos (`Lun`…`Dom`). Si tiene días, toca esos días; si no, toca por intervalo desde la última vez.                                        |
| `Persona`     | Select       | Mismos nombres que en Suplementos; `Compartido` (o vacío) = cualquiera.                                                                        |
| `Pausada`     | Casilla      | Marcada = oculta. Es «Pausada» y no «Activa» porque Notion crea las casillas desmarcadas: una fila nueva ya aparece.                           |
| `Última vez`  | Fecha        | La app la escribe al marcar y la restaura al desmarcar.                                                                                        |
| `Hecha por`   | Texto        | La app escribe el nombre del perfil que marcó.                                                                                                 |
| `Notas`       | Texto        | Opcional, se muestra bajo la tarea.                                                                                                            |

Sin `Última vez`, el «hecho» se guarda solo en el teléfono (`chores_local_done_v1`).

## Qué toca hoy (`src/utils/choreSchedule.ts`)

- Con `Días`: toca cada uno de esos días de la semana (Lun + Jue = dos veces por semana); `Frecuencia` se ignora.
- Sin `Días`: toca si nunca se hizo o si pasaron ≥ intervalo (1/7/14/30/N días) desde `Última vez`. Si se atrasa, sigue apareciendo con «Atrasada N días» hasta que alguien la marque.
- Hecha hoy: se muestra marcada (tachada) en su grupo.

## App

- `useChores(user, día)`: carga, marcado optimista con reversión si Notion falla, y deshacer que restaura la fecha anterior (`chores_undo_v1`). También `discover()` para cuentas conectadas antes de esta función: busca la base sin pedir el token (`updateStoredNotionIds`).
- Pestaña **Casa** (`src/screens/Chores.tsx`): «Para ti», «Para cualquiera» y «De otras personas» (plegado; se puede marcar si la hiciste tú). Atrasadas primero, hechas al final. La cabecera dice «Te faltan N tareas hoy».
- Demo: cinco tareas de ejemplo (diaria compartida, días fijos, cada N días, atrasada).
- Interfaz: el mismo patrón neurodivergente que Inicio (checkbox accesible, tachado además del color, filas de 64 pt, texto que dice qué falta).
