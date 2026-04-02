/**
 * Espacio extra bajo listas/scroll respecto al borde inferior de pantalla cuando la tab bar
 * es flotante en `App.tsx` (margen al home indicator + altura píldora + separación al contenido).
 * No incluye `useSafeAreaInsets().bottom`: sumarlo en cada pantalla.
 */
export const FLOATING_TAB_BAR_EXTRA = 78;

/** Debajo del notch / status: sumar `useSafeAreaInsets().top` en pantallas con scroll o cabecera. */
export const SCREEN_PADDING_TOP_EXTRA = 18;

/** Aire bajo el contenido antes del home indicator + tab flotante: sumar `insets.bottom + FLOATING_TAB_BAR_EXTRA`. */
export const SCREEN_SCROLL_PADDING_BOTTOM_EXTRA = 20;
