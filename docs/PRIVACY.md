# Política de privacidad — La Comuna App

_Última actualización: julio 2026_

La Comuna App es una app de seguimiento de suplementos alineados a las fases del ciclo menstrual. Está diseñada para que **tus datos vivan contigo**: en tu teléfono y en tu propio workspace de Notion.

## Qué datos maneja la app y a dónde van

| Dato                                 | Dónde se guarda                                                  | ¿Sale del dispositivo?                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suplementos, fases y plan de comidas | Tu workspace de Notion (el que tú conectas) + caché SQLite local | Solo hacia **tu** Notion, con **tu** token                                                                                                           |
| Registro diario de tomas y stock     | SQLite local en tu teléfono                                      | No                                                                                                                                                   |
| Token de integración de Notion       | Llavero del dispositivo (Keychain vía SecureStore)               | Solo se usa para llamar a la API de Notion                                                                                                           |
| Ciclo menstrual (HealthKit)          | Se lee de Apple Salud **en el dispositivo** con tu permiso       | No se envía a servidores; puede actualizar la fase en **tu** Notion si activas esa sincronización                                                    |
| Errores técnicos (opcional)          | Sentry, solo en builds de distribución del maintainer            | Stack traces técnicos, sin datos de salud                                                                                                            |
| Eventos de producto (opcional)       | PostHog, solo en builds de distribución del maintainer           | Eventos de uso (p. ej. "abrió pestaña Stock") identificados por perfil genérico (`profile_1`/`profile_2`), sin datos de salud ni contenido de Notion |

## Lo que NO hacemos

- No tenemos servidores propios con tus datos: no hay cuenta, ni registro, ni base de datos nuestra.
- No vendemos ni compartimos datos con terceros.
- No enviamos datos de HealthKit a ningún servicio externo (tampoco a Sentry/PostHog).
- No usamos publicidad ni rastreo entre apps (App Tracking Transparency no aplica).

## Modo de ejemplo

El modo "Explorar con datos de ejemplo" funciona 100% en el dispositivo, sin ninguna conexión a Notion.

## Tu control

- **Desconectar Notion** (Perfil → Conexión Notion) borra el token y los IDs guardados en el teléfono; tus datos en Notion no se tocan.
- Borrar la app elimina la caché SQLite y el token del llavero.
- Los permisos de HealthKit se gestionan en Ajustes → Salud → Acceso a datos.

## Open source

El código es abierto (GPL-3.0): puedes auditar exactamente qué hace la app en [github.com/sistemasconscientes/comuna-app](https://github.com/sistemasconscientes/comuna-app).

## Contacto

Dudas o reportes de privacidad: abre un issue en el repositorio o escribe al correo indicado en la ficha de App Store.
