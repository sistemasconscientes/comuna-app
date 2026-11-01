# Brief A: actualizar el template público de Notion

> Para una sesión de Cowork (o a mano) **con el workspace del template abierto**: el que se duplica desde el Marketplace, no un workspace personal. Si el conector de Notion apunta a otro workspace, detente y avisa. Los nombres de propiedades deben quedar **exactos** (mayúsculas, acentos y «?»): la app los busca por nombre.

## Contexto

La Comuna App (iOS) lee de Notion los suplementos, las fases del ciclo, el plan de comidas y las tareas del hogar. La nueva versión agrega:

- Hogares de hasta 8 personas, con o sin ciclo menstrual.
- Stock compartido entre teléfonos guardado en Notion (sin servidor).
- Tareas del hogar por día (pestaña Casa).
- Nutrientes por toma, que la app puede registrar en Apple Salud.
- Agrupación de la lista del día por momento, según el texto de Dosis.

Casi todos los cambios son aditivos. La excepción es renombrar `Ambas` → `Compartido` (A1): la versión nueva de la app acepta los dos, pero las versiones anteriores solo reconocen `Ambas`. El template nuevo es para la versión de App Store.

## Reglas que la app necesita (no romper)

- **Títulos** (la app detecta el template por título):
  - La base de suplementos contiene una palabra que empieza por «Suplement».
  - La página de fases, una palabra que empieza por «Fase».
  - El hub de comidas, «Comida…» o «Cocina…», y dentro un encabezado H2 exacto **«Comidas Activas»**.
  - La base de tés se llama «Té» o «Tés».
  - La base de tareas contiene una palabra que empieza por «Tarea».
  - No renombres ninguno.
- **Propiedades existentes** (nombres exactos; también valen `Name`, `Dose`, `Category`): `Nombre`, `Dosis`, `Categoría`, `Temporada`, `Persona`, `Disponible` (casilla), `Recompra?` (casilla). En Tés: `¿Tengo en casa?` y `Fase del ciclo recomendada`.
- **Temporada es obligatoria** en cada suplemento visible. Sin Temporada, el suplemento **no aparece** en Inicio. Valores reconocidos: `Todo el año`, `Q1`…`Q4` (trimestre actual), `Fase folicular` y `Fase lútea` (solo esas dos fases).
- **Disponible** = ✓ para que el suplemento aparezca.

---

## A1. Base de datos «Suplementos»

1. Propiedad **Persona** (select):
   - Renombra la opción `Ambas` a `Compartido`. Renombrar conserva el valor en las páginas.
   - Deja como opciones de ejemplo `Luna`, `Mar`, `Sol` y `Compartido`. Quita los nombres reales si quedan.
2. Agrega estas propiedades si no existen:
   - `Frasco abierto`: Fecha
   - `Pastillas por frasco`: Número
   - `Pastillas al día`: Número
   - `Nutrientes`: Texto
   - `Recompra?`: Casilla (seguramente ya existe; no la renombres)
3. Filas de ejemplo (5 o 6, todas con `Disponible` = ✓):
   - **Dosis:** incluye siempre el momento: «por la noche», «en ayunas», «al desayuno», «con la comida», «por la tarde». La app agrupa la lista con esas palabras.
   - **Nutrientes:** usa este formato exacto: `Nombre cantidad unidad`, varios separados por `; ` (punto y coma y espacio). Es el mismo formato que escribe la app.
     - Unidades válidas: `mg`, `µg` (o `mcg`) y `g`. `UI` solo para vitamina D.
     - Valor completo de una celda con un nutriente: `Magnesio 200 mg`
     - Valor completo de una celda con dos: `Vitamina D 50 µg; Vitamina K 100 µg`
   - **Temporada:** todas la llevan. Casi todas «Todo el año»; una «Fase folicular» y otra «Fase lútea», para mostrar el filtro por fase.
   - Al menos una con Persona `Sol` (alguien sin ciclo) y Temporada «Todo el año».
   - Al menos una `Compartido` con stock de ejemplo: `Frasco abierto` hace unos días, `Pastillas por frasco` = 60, `Pastillas al día` = 1.
4. Descripción de la base: «Persona = quién lo toma; «Compartido» = todo el hogar. Nutrientes: escribe o escanea la tabla nutricional desde la app (Stock → editar).»

## A2. Página «Fases»

1. Tabla inline de 3 columnas. **La app la lee por posición, no por el nombre de columna**: 1.ª = persona, 2.ª = fase, 3.ª = próximo ciclo. Los encabezados son libres (por ejemplo «Persona · Fase del ciclo actual · Siguiente ciclo esperado»). No reordenes las columnas.
2. Filas de ejemplo:
   - `Luna` · `Folicular 🌸` · fecha dentro de unos **20 días** (día ~8 de 28)
   - `Mar` · `Lútea 🦥` · fecha dentro de unos 5 días (día ~23 de 28)
   - `Sol` · `Sin ciclo` · (vacío)
3. Callout encima de la tabla:
   > Una fila por persona que sigue su ciclo. Si alguien de la casa no menstrúa, escribe «Sin ciclo» en la fase o no le pongas fila: basta con que aparezca en el select Persona de Suplementos. Hasta 8 personas. El orden de las filas es el orden de los perfiles en la app (y de las columnas de platos en Comidas): no las reordenes después de conectar. Las fechas de ejemplo no se actualizan solas; la app reescribe fase y próximo ciclo cuando das permiso a Apple Salud.

## A3. Plan de comidas («Comidas Activas»)

**No reestructures tablas.** Solo agrega, bajo el encabezado «Comidas Activas», esta nota:

> Si los platos cambian por persona, pon una columna de plato por persona, en el mismo orden que las filas de Fases (columna 1 = primera fila). Después van las personas que solo están en el select Persona, en el orden del select; «Compartido» no cuenta como persona. Con una sola columna de plato, es para todo el hogar.

## A4. Base «Tareas del hogar» (nueva)

Créala **dentro de la misma página que contiene la base Suplementos**. Así hereda la conexión de la integración y nadie tiene que conectarla a mano.

- Título de la base: **«Tareas del hogar»**
- `Tarea`: Título
- `Frecuencia`: Select con `Diaria`, `Semanal`, `Cada 2 semanas`, `Mensual`, `Cada N días`
- `Cada (días)`: Número (solo para «Cada N días»)
- `Días`: Multi-select con `Lun`, `Mar`, `Mié`, `Jue`, `Vie`, `Sáb`, `Dom`
- `Persona`: Select con las mismas opciones que Suplementos (`Luna`, `Mar`, `Sol`, `Compartido`)
- `Pausada`: Casilla (desmarcada = la tarea cuenta; no hace falta plantilla)
- `Última vez`: Fecha (la escribe la app; déjala vacía)
- `Hecha por`: Texto (la escribe la app; déjalo vacío)
- `Notas`: Texto (opcional)

Cómo decide la app qué toca (ponlo en la descripción de la base, resumido):

- **Con `Días`:** la tarea toca **cada uno** de esos días de la semana, y `Frecuencia` se ignora. «Sacar la basura» con Lun + Jue = dos veces por semana.
- **Sin `Días`:** toca cuando pasó su frecuencia desde `Última vez`. Si `Última vez` está vacía, toca **desde hoy**, y al marcarla empieza a contar. Si se atrasa, sigue apareciendo hasta que alguien la marque.

Filas de ejemplo:

- «Lavar trastes»: Diaria, Compartido
- «Sacar la basura»: Días Lun + Jue, Luna (Frecuencia: Semanal)
- «Regar plantas»: Cada N días, `Cada (días)` = 3, Mar
- «Limpiar baño»: Semanal, Sol
- «Cambiar sábanas»: Cada 2 semanas, Compartido
- «Limpiar refri»: Mensual, Compartido

Descripción de la base: «Lo que toca cada día aparece en la pestaña Casa de la app; al marcarla se llena Última vez para todo el hogar. Con Días, la tarea toca cada uno de esos días; sin Días, según la frecuencia. Marca Pausada para ocultarla.»

## A5. Portada del template

Agrega una sección «Cómo se usa en casa» con 4 viñetas:

- Cada persona es un perfil en la app.
- «Compartido» es para lo de todos.
- Quien no menstrúa usa «Sin ciclo».
- La app no es consejo médico: consulta a un profesional antes de cambiar suplementos.

## Al terminar

Reporta una tabla `sección · hecho / pendiente · nota`.

**Paso manual, no lo hace el conector:** actualizar la ficha del Marketplace desde el navegador y re-publicar el template. La descripción debe cubrir hogares y roomies, perfiles sin ciclo, stock compartido entre teléfonos, nutrientes en Apple Salud (opcional) y el aviso de que no es consejo médico.
