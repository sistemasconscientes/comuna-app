# Spec: Pantalla de splash y barra de estado (fondo cálido)

**Config:** [`app.json`](../../app.json) (`expo.splash`)  
**Runtime:** [`App.tsx`](../../App.tsx) — `StatusBar` de `expo-status-bar`

---

## Alcance

- Imagen de splash nativa y color de fondo al arrancar la app (iOS y la misma config raíz de Expo).
- Apariencia de la barra de estado en runtime: iconos y texto oscuros, coherente con UI clara / fondo cálido.

Fuera de alcance: splash de desarrollo de Metro, branding Android específico (`androidStatusBar`) salvo que se amplíe este spec.

---

## Criterios de aceptación

1. En `app.json`, `expo.splash.image` es `./assets/splash-icon.png`.
2. En `app.json`, `expo.splash.resizeMode` es `contain`.
3. En `app.json`, `expo.splash.backgroundColor` es `#FAF8F5` (crema cálido).
4. Tras instalar o sustituir el asset en `assets/splash-icon.png`, la pantalla de arranque muestra la imagen contenida sobre el fondo definido (sin recortes inesperados por `contain`).
5. En la raíz de la app (`App.tsx`), `StatusBar` usa `style="dark"` (`expo-status-bar`), de modo que el contenido de la status bar sea oscuro sobre fondos claros (equivalente a *dark content* en iOS).

---

## Verificación (nativo)

Cambios en imagen o color de splash **no** se reflejan solo con reload de Metro: hace falta **rebuild** del binario nativo (p. ej. `expo run:ios`, EAS build, o prebuild + run).

---

## PostHog

Sin nuevos eventos ni variables de entorno para este spec.
