---
name: Bug report
about: Reportar un error
title: "[bug] "
labels: bug
body:
  - type: dropdown
    id: platform
    attributes:
      label: Plataforma
      options:
        - iOS
        - Android (comunidad)
        - Backend
        - Docs
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Pasos para reproducir
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Comportamiento esperado
  - type: textarea
    id: logs
    attributes:
      label: Logs / capturas (sin secretos ni datos de salud)
