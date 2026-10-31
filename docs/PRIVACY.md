# Política de privacidad — La Comuna App

_Última actualización: octubre 2026_

_URL canónica de este documento (la que se declara en App Store Connect): <https://github.com/sistemasconscientes/comuna-app/blob/main/docs/PRIVACY.md>_

La Comuna App es una app de seguimiento de suplementos para uno o varios perfiles en un mismo hogar; quien sigue su ciclo menstrual puede alinearlos a sus fases. Es un proyecto open source sin fines de lucro, diseñado para que **tus datos vivan contigo**: en tu teléfono y en tu propio workspace de Notion.

## Qué datos maneja la app y a dónde van

| Dato                                                 | Dónde se guarda                                                                   | ¿Sale del dispositivo?                                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suplementos, fases y plan de comidas                 | Tu workspace de Notion (el que tú conectas) + caché SQLite local                  | Solo hacia **tu** Notion, con **tu** token                                                                                                                              |
| Registro diario de tomas, stock y perfiles           | SQLite / almacenamiento local en tu teléfono                                      | No                                                                                                                                                                      |
| Token de integración de Notion                       | Llavero del dispositivo (Keychain vía SecureStore)                                | Solo se usa para llamar a la API de Notion                                                                                                                              |
| Ciclo menstrual y señales de Apple Salud (HealthKit) | Se leen **en el dispositivo** con tu permiso, solo para perfiles que siguen ciclo | Los datos de Salud no salen del teléfono. Solo la **fase estimada** y la fecha de tu próximo ciclo se escriben en la tabla de fases de **tu** Notion                    |
| Errores técnicos (opcional)                          | Sentry, solo en builds de distribución del maintainer                             | Stack traces técnicos, sin datos de salud, sin IP ni identificadores del dispositivo. Puedes apagarlo                                                                   |
| Eventos de producto (opcional)                       | PostHog, solo en builds de distribución del maintainer                            | Eventos de uso (p. ej. "abrió pestaña Stock") identificados por perfil genérico (`profile_1`, `profile_2`…), sin datos de salud ni contenido de Notion. Puedes apagarlo |

## Lo que NO hacemos

- No tenemos servidores propios con tus datos: no hay cuenta, ni registro, ni base de datos nuestra.
- No vendemos ni compartimos datos con terceros.
- No enviamos datos de HealthKit a ningún servicio externo (tampoco a Sentry/PostHog). No escribimos en Apple Salud.
- No guardamos datos de salud en iCloud.
- No usamos publicidad ni rastreo entre apps (App Tracking Transparency no aplica).

## Modo de ejemplo

El modo "Explorar con datos de ejemplo" funciona 100% en el dispositivo, sin ninguna conexión a Notion.

## Tu control

- **Desconectar Notion** (Perfil → Conexión Notion) borra el token y los IDs guardados en el teléfono; tus datos en Notion no se tocan.
- Borrar la app elimina la caché SQLite y el token del llavero.
- **Diagnósticos:** Perfil → Privacidad y datos → «Compartir diagnósticos anónimos» apaga Sentry y PostHog en ese teléfono.
- Un perfil marcado «sin seguimiento de ciclo» no lee el ciclo en Apple Salud.
- Los permisos de HealthKit se gestionan en Ajustes → Salud → Acceso a datos.

## Aviso de salud

La Comuna no es un dispositivo médico. No prescribe suplementos ni dosis, y la fase que muestra es una estimación orientativa (no un diagnóstico ni un método anticonceptivo). Consulta a un profesional de la salud antes de empezar, cambiar o dejar un suplemento.

## Open source y edad

El código es software libre bajo la licencia GNU GPL v3 y el proyecto no tiene fines de lucro: puedes auditar exactamente qué hace la app en [github.com/sistemasconscientes/comuna-app](https://github.com/sistemasconscientes/comuna-app). La app está pensada para personas mayores de edad (18+).

## Contacto

Dudas o reportes de privacidad: abre un issue en [el repositorio](https://github.com/sistemasconscientes/comuna-app/issues) o escribe a **diana@sistemasconscientes.tech**.
