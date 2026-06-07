---

name: Feature request
about: Proponer una mejora
title: "[feat] "
labels: enhancement
body:

- type: textarea
  id: problem
  attributes:
  label: Problema o necesidad
  validations:
  required: true
- type: textarea
  id: solution
  attributes:
  label: Solución propuesta
- type: checkboxes
  id: spec
  attributes:
  label: Spec
  options: - label: Incluiré o referenciaré spec en docs/specs/ si aplica
