# Brief: actualizar el template público de Notion

> Para pegar en un agente (p. ej. Cowork) o seguir a mano. Los nombres de propiedades deben quedar **exactos** (mayúsculas, acentos y «?»): la app los busca por nombre.

## Contexto

La Comuna App (iOS) lee de Notion los suplementos, las fases del ciclo y el plan de comidas. La nueva versión agrega:

- Hogares de hasta 8 personas, con o sin ciclo menstrual.
- Stock compartido entre teléfonos guardado en Notion (sin servidor).
- Tareas del hogar por día (pestaña Casa), desde una base de Notion con frecuencia y persona.
- Nutrientes por toma, que la app puede registrar en Apple Salud.
- Agrupación de la lista del día por momento, según el texto de Dosis.

La app sigue funcionando con el template viejo, así que todos los cambios son aditivos.

## Reglas que la app necesita (no romper)

- **Títulos** (la app detecta el template por título): la base de suplementos contiene una palabra que empieza por «Suplement»; la página de fases, una palabra que empieza por «Fase»; el hub de comidas, «Comida…» o «Cocina…» y dentro un encabezado H2 exacto **«Comidas Activas»**; la base de tés se llama «Té» o «Tés». No los renombres.
- **Propiedades existentes** (nombres exactos; también valen `Name`, `Dose`, `Category`): `Nombre`, `Dosis`, `Categoría`, `Temporada`, `Persona`, `Disponible` (casilla), `Recompra?` (casilla). En Tés: `¿Tengo en casa?` y `Fase del ciclo recomendada`.
- **Temporada es obligatoria** en cada suplemento visible. Sin Temporada, el suplemento **no aparece** en Inicio. Valores reconocidos: `Todo el año`, `Q1`…`Q4` (trimestre actual) y `Fase folicular` / `Fase lútea` (solo esas dos fases).
- **Disponible** = ✓ para que el suplemento aparezca.

---

## A. Template público (workspace del template del Marketplace)

### A1. Base de datos «Suplementos»

1. Propiedad **Persona** (select):
   - Renombra la opción `Ambas` a `Compartido`. Renombrar conserva el valor en las páginas.
   - Deja como opciones de ejemplo `Luna`, `Mar`, `Sol` y `Compartido`. Quita los nombres reales si quedan (Diana, Estefanía).
2. Agrega estas propiedades si no existen:
   - `Frasco abierto`: Fecha
   - `Pastillas por frasco`: Número
   - `Pastillas al día`: Número
   - `Nutrientes`: Texto
   - `Recompra?`: Casilla (seguramente ya existe; no la renombres)
3. Ejemplos (5 o 6 filas, `Disponible` = ✓):
   - En **Dosis**, incluye siempre el momento: «por la noche», «en ayunas», «al desayuno», «con la comida», «por la tarde». La app agrupa la lista con esas palabras.
   - En **Nutrientes**, usa el formato `Nombre cantidad unidad` separado por «;». Por ejemplo: `Magnesio 200 mg`, `Vitamina D 50 µg; Vitamina K 100 µg`, `Hierro 15 mg`. Unidades válidas: mg, µg (o mcg) y g; UI solo para vitamina D.
   - **Todos** con Temporada (casi todos «Todo el año»; uno con «Fase folicular» y otro con «Fase lútea» para mostrar el filtro por fase).
   - Al menos uno con Persona `Sol` (alguien sin ciclo) y Temporada «Todo el año».
   - Al menos uno `Compartido` con stock de ejemplo: `Frasco abierto` hace unos días, `Pastillas por frasco` = 60, `Pastillas al día` = 1.
4. En la descripción de la base, agrega: «Persona = quién lo toma; «Compartido» = todo el hogar. Nutrientes: escribe o escanea la tabla nutricional desde la app (Stock → editar).»

### A2. Página «Fases»

1. Tabla inline de 3 columnas: Persona · Fase · Próximo ciclo. Filas de ejemplo:
   - `Luna` · `Folicular 🌸` · fecha dentro de unos 12 días
   - `Mar` · `Lútea 🦥` · fecha dentro de unos 5 días
   - `Sol` · `Sin ciclo` · (vacío)
2. Callout encima de la tabla:
   > Una fila por persona que sigue su ciclo. Si alguien de la casa no menstrúa, escribe «Sin ciclo» en Fase o no le pongas fila: basta con que aparezca en el select Persona de Suplementos. Hasta 8 personas. La app actualiza Fase y Próximo ciclo sola si das permiso a Apple Salud.

### A3. Plan de comidas («Comidas Activas»)

En las tablas por día: si los platos cambian por persona, una columna de plato por persona en el mismo orden que la tabla de Fases (col 1 = primera fila de Fases; las personas que solo están en el select Persona van al final, en el orden del select). Si hay una sola columna de plato, es para todo el hogar. Agrega una nota corta explicando esto.

### A3b. Base «Tareas del hogar» (nueva)

Créala junto a Suplementos. Nombres exactos:

- Título de la base: **«Tareas del hogar»** (la app la busca por la palabra «Tareas»).
- `Tarea`: Título
- `Frecuencia`: Select con las opciones `Diaria`, `Semanal`, `Cada 2 semanas`, `Mensual`, `Cada N días`
- `Cada (días)`: Número (solo para «Cada N días»)
- `Días`: Multi-select con `Lun`, `Mar`, `Mié`, `Jue`, `Vie`, `Sáb`, `Dom` (opcional: días fijos)
- `Persona`: Select con las mismas opciones que en Suplementos (`Luna`, `Mar`, `Sol`, `Compartido`)
- `Activa`: Casilla (✓ por defecto)
- `Última vez`: Fecha (la escribe la app; déjala vacía)
- `Hecha por`: Texto (la escribe la app; déjalo vacío)
- `Notas`: Texto (opcional)

Ejemplos (6 a 8):

- «Lavar trastes»: Diaria, Compartido
- «Sacar la basura»: Semanal, Días Lun + Jue, Luna
- «Regar plantas»: Cada N días, `Cada (días)` = 3, Mar
- «Limpiar baño»: Semanal, Sol
- «Cambiar sábanas»: Cada 2 semanas, Compartido
- «Limpiar refri»: Mensual, Compartido

Descripción de la base: «Lo que toca cada día aparece en la pestaña Casa de la app; al marcarla se llena Última vez para todo el hogar.»

### A4. Portada del template

Agrega una sección «Cómo se usa en casa» con 4 viñetas:

- Cada persona es un perfil en la app.
- «Compartido» es para lo de todos.
- Quien no menstrúa usa «Sin ciclo».
- La app no es consejo médico: consulta a un profesional antes de cambiar suplementos.

### A5. Ficha del Marketplace

Actualiza la descripción: hogares y roomies, perfiles sin ciclo, stock compartido entre teléfonos, nutrientes en Apple Salud (opcional) y el aviso de que no es consejo médico. Después re-publica el template.
