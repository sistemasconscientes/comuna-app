# Política de seguridad

## Reportar vulnerabilidades

Abre un **issue privado** o escribe al mantenedor vía GitHub (Laboratorio de Sistemas Conscientes). No publiques exploits en issues públicos.

Incluye: pasos para reproducir, impacto, versión afectada. **No adjuntes** `.env`, tokens ni capturas con datos de salud.

## Datos que maneja la app

| Dato | Dónde | Notas |
|------|-------|-------|
| Ciclo menstrual | HealthKit (dispositivo) | Opcional; solo iOS |
| Fase / próximo ciclo | Notion (si configuras sync) | Escritura vía `updatePhase` |
| Tomas de suplementos | SQLite local | Por perfil |
| Eventos de producto | PostHog (opcional) | Sin PII por defecto en eventos críticos |
| Errores | Sentry (opcional) | Stack traces; configurar DSN en fork |

## Disclaimer de salud

La app **no es consejo médico**. Cada usuaria debe consultar a profesionales de salud antes de cambiar suplementación.

## Pre-push (mantenedores)

Antes del primer push público: auditoría de historial git + escaneo (gitleaks/trufflehog). Ver [CONTRIBUTING.md](CONTRIBUTING.md).
