# Spec: Pantalla de splash y barra de estado (tema oscuro)

**Config:** [`app.json`](../../app.json) (`expo.splash`, `userInterfaceStyle`)  
**Runtime:** [`App.tsx`](../../App.tsx) — `StatusBar` de `expo-status-bar`

---

## Alcance

- Imagen de splash nativa y color de fondo al arrancar la app (**iOS**; la misma config raíz de Expo aplica también si existiera build Android).
- Apariencia de la barra de estado en runtime: iconos y texto **claros** (*light content*), coherente con **UI oscura** (`theme.bg`, pestañas, pantallas).

Fuera de alcance: splash de desarrollo de Metro, branding Android específico (`androidStatusBar`) salvo que se amplíe este spec.

---

## Criterios de aceptación

1. En `app.json`, `expo.splash.image` es `./assets/splash-icon.png`.
2. En `app.json`, `expo.splash.resizeMode` es `contain`.
3. En `app.json`, `expo.splash.backgroundColor` es **`#141210`** (alineado con fondo oscuro de la app y splash asset).
4. En `app.json`, `expo.userInterfaceStyle` es **`dark`** para coherencia con la UI principal.
5. Tras instalar o sustituir el asset en `assets/splash-icon.png`, la pantalla de arranque muestra la imagen contenida sobre el fondo definido (sin recortes inesperados por `contain`).
6. En la raíz de la app (`App.tsx`), `StatusBar` usa **`style="light"`** (`expo-status-bar`), de modo que el contenido de la status bar sea claro sobre fondos oscuros (equivalente a *light content* en iOS).

---

## Verificación (nativo)

Cambios en imagen o color de splash **no** se reflejan solo con reload de Metro: hace falta **rebuild** del binario nativo (p. ej. `expo run:ios`, EAS build, o prebuild + run).

---

## PostHog

Sin nuevos eventos ni variables de entorno para este spec.
