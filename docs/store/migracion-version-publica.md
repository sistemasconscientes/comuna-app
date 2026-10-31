# Migrar de la versión personal a la publicada (App Store)

Guía para que Diana (y Estefanía) dejen el build personal (dev client + `.env` + `profiles.local.ts` + backend de stock) y usen la misma app que cualquier persona descarga. Personal: **no portar este archivo a `oss/public`**.

## 0. Antes de publicar

1. Mergear la rama de trabajo al `main` local y correr `npm test`.
2. Recorrer el skill `app-store-review-checklist` completo.
3. Actualizar el template de Notion (sección 1) y re-publicarlo en el Marketplace.
4. `npm run eas:build:production` → probar en TestFlight → `npm run eas:submit:production`.

## 1. Cambios al template público de Notion (manual, en el workspace del template)

La app sigue aceptando el template viejo (`Ambas`, dos filas de fases), así que esto no rompe a nadie.

1. **DB Suplementos → propiedad Persona:** renombrar la opción `Ambas` a `Compartido`. Renombrar conserva los valores de las páginas existentes; la app reconoce las dos.
2. **Ejemplos genéricos:** cambiar las personas de ejemplo (Diana / Estefanía) por nombres neutros, por ejemplo Luna y Mar con ciclo y Sol sin ciclo. Así quien duplica el template no hereda nombres reales.
3. **Página Fases:** agregar un callout arriba de la tabla:
   > Una fila por persona que sigue su ciclo (Persona · Fase · Próximo ciclo). Si alguien de la casa no menstrúa, escribe «Sin ciclo» en Fase o no le pongas fila: basta con que aparezca en el select Persona de Suplementos. Hasta 8 personas.
4. **Plan de comidas:** si hay platos distintos por persona, una columna de plato por persona, en el mismo orden que la tabla de fases. Con una sola columna, el plato es para todo el hogar.
5. **Descripción del Marketplace:** mencionar hogares y roomies, perfiles sin ciclo y el aviso de que no es consejo médico.

## 2. Cambiarte a la app publicada (tu teléfono)

1. Instala el build de producción (TestFlight primero, App Store después). El bundle (`com.janee.comunaapp`) es el mismo, así que reemplaza la app de desarrollo. El historial local de tomas y el stock deberían conservarse. Si quieres, primero haz una captura de Stock como respaldo.
2. El build de producción **no** trae credenciales de Notion. Si la app abre el onboarding:
   - Notion → `notion.so/my-integrations` → nueva integración interna «La Comuna (app)» en el workspace Hadas → copia el token.
   - En «💊 Salud del hogar» (o la página que contenga Suplementos, Fases y Comidas): menú ··· → Conexiones → elige la integración.
   - Pega el token en la app → Conectar.
3. Revisa Perfil → «Perfiles en este teléfono»: deberían aparecer Diana y Estefanía con «Sigue ciclo». Ajusta emojis y nombres.
4. **Stock compartido:** la versión pública no usa el backend de Render, así que los suplementos «Ambas/Compartido» pasan a llevar stock **local en cada teléfono**. Copia a mano en Stock → editar los conteos actuales de esos suplementos (los ves en el backend o en la app vieja antes de reemplazarla).
5. Activa los recordatorios en Perfil si los usabas, y acepta el permiso de Apple Salud.
6. Estefanía repite los pasos 1 a 5 en su teléfono. Puede usar el mismo token: es del mismo workspace.

## 3. Deprecar la versión personal

1. Borra `src/config/profiles.local.ts` y las `NOTION_*` del `.env` (o déjalas solo para desarrollo). Desde ahora, también en desarrollo te conectas por onboarding.
2. Backend de stock: quita `EXPO_PUBLIC_BACKEND_URL` de los perfiles de `eas.json`, marca `docs/specs/backend-stock-api.md` como deprecado y apaga el servicio en Render cuando ya no lo use nadie. Si después quieren stock compartido entre teléfonos, la vía sin servidor es guardar el conteo en propiedades de la página del suplemento en Notion.
3. `DEFAULT_TEAS_DB_ID` en `src/api/notion.ts` solo aplica a la config por `.env`; se puede retirar cuando nadie la use.
4. Alinear ramas: portar `src/`, tests y docs a `oss/public` siguiendo la frontera de sanitización (correr `grep -rE 'comunaapp|sistemasconscientes|labsistemasconscientes|comuna-backend-vbck|4c8d61f7'` antes de `git push origin oss/public:main`). Meta a mediano plazo: mover los identificadores personales (`eas.json`, Sentry en `app.json`) a EAS env / `app.config` para que `main` y `oss/public` dejen de divergir.
