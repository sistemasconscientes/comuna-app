# Energía, nutrientes, stock compartido vía Notion e interfaz neurodivergente

## Energía disponible (`src/utils/energy.ts`, `useEnergy`, `EnergyCard`)

- Fuente: tramos «dormida» de `HKCategoryTypeIdentifierSleepAnalysis` (`fetchSleepIntervals`, últimas ~60 noches) de **este teléfono**.
- Noche = día civil de despertar (inicio del tramo + 6 h); los solapes entre fuentes se fusionan.
- Referencia, en orden de preferencia: (1) mediana de tus noches previas **en la misma fase** (4 o más, ventana de 60 noches; la fase de cada noche se reconstruye con el último inicio de periodo y la duración de ciclo); (2) mediana de las últimas 14 noches (5 o más); (3) 7 h 30.
- Umbrales base: **baja** si < 5 h o < 80 % de la referencia; **media** si < 6 h 30 o < 92 %; si no, **alta**.
- **Sueño según fase** (personas que menstrúan): en lútea y menstrual el sueño suele ser más fragmentado (la progesterona sube la temperatura; molestias premenstruales y menstruales), así que los umbrales piden más: baja < 5 h 30 o < 85 %; media < 7 h o < 97 %. La nota de fase lo explica en una frase.
- Sin ajuste por fase si Salud reporta anticonceptivo hormonal, embarazo o lactancia (el patrón cambia): se usa el sueño general y la nota lo dice.
- Permisos: la energía solo pide lectura de sueño (no el set completo de ciclo), así que un perfil sin ciclo nunca ve una solicitud de datos menstruales.
- UI: símbolo + palabra (○ Baja, ◐ Media, ● Alta), una sugerencia concreta y «¿Cómo se calcula?» plegable. Es orientativo, no una medición médica (1.4.1).
- Modo demo: una semana de sueño de ejemplo para App Review.

## Nutrientes → Apple Salud (`src/utils/nutrients.ts`, `src/api/nutrientsHealth.ts`)

- Texto por toma en la propiedad **`Nutrientes`** (rich text) de la DB de Suplementos; si la DB no la tiene, se usa el respaldo local (AsyncStorage `supplement_nutrients_local_v1`).
- Captura: campo multilínea en el modal de Stock. Para la cámara se usa el **«Escanear texto» (Live Text) nativo de iOS** del menú del campo: no hace falta un módulo nativo nuevo ni permiso de cámara de la app.
- `parseNutrients`: solo nutrientes conocidos con cantidad **y** unidad (mg, µg/mcg/ug, g; UI solo para vitamina D, 40 UI = 1 µg). Ignora %VD y lo ambiguo. Se guarda normalizado («Magnesio 200 mg; Vitamina D 50 µg»).
- Escritura: **opt-in por perfil** (Perfil → Apple Salud). Al marcar una toma, una muestra `HKQuantityTypeIdentifierDietary…` por nutriente (ahora si la toma es de hoy; mediodía si es de otro día), con metadata `ComunaLogKey`. Al desmarcar se borran esos uuids. Cola serializada para que los toques rápidos no se pisen.
- Permiso de escritura: se pide solo para los tipos que se van a escribir, en el primer guardado.

## Stock compartido sin servidor (`sharedStock.ts` + `notion.ts`)

- Si la DB de Suplementos tiene `Pastillas por frasco` (detectado en `getSupplements`), el stock de los suplementos con Persona compartida se lee y escribe en la página: `Frasco abierto` (date), `Pastillas por frasco` (number), `Pastillas al día` (number) y `Recompra?` (checkbox). Así se sincroniza entre los teléfonos del hogar.
- Prioridad: backend configurado (builds del maintainer) > propiedades de Notion > SQLite local.

## Interfaz con enfoque neurodivergente

- **Inicio**: lo accionable primero (energía → lista), lo decorativo después (fase, té). La lista se agrupa por momento del día, inferido del texto de dosis (`doseMoment`: Mañana / Mediodía y tarde / Noche / Cuando quieras). El grupo de ahora lleva el badge «Ahora» y un borde (no solo color).
- El progreso dice «Te faltan N» / «Todo listo», y al completar aparece «✓ Listo por hoy», sin animaciones ni gamificación.
- Una toma marcada se ve tachada y atenuada, además del check. Las filas miden 64 pt de alto y usan `accessibilityRole="checkbox"`.
- El botón de ajustes tiene icono + texto «Ajustes».
- **Modo simple** (Perfil → Pantalla, `uiPrefs.simpleMode`): oculta el té y la barra de fase.
- Respeta «Reducir movimiento» del sistema (`useReduceMotion`: el modal de Stock usa fade en vez de slide).
- Lenguaje: frases cortas en tú (sin voseo), mensajes de error que dicen qué hacer y una explicación de cada cálculo a un toque.
