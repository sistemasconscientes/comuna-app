---
name: app-store-review-checklist
description: Checklist anti-rechazo de App Review para Comuna App (iOS, HealthKit, Notion, modo demo, Sentry/PostHog). Úsalo antes de cada `eas:submit:production`, al cambiar permisos/SDKs/analítica/links externos, o cuando Apple rechace un build.
---

# App Store Review — checklist anti-rechazo (Comuna)

Fuente: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) + [requisitos de SDK](https://developer.apple.com/news/upcoming-requirements/). Revisado oct 2026. Si una guideline citada aquí cambió, actualiza este archivo.

## Cómo usarlo

1. Recorre cada sección y marca ✅ / ❌ / N/A. **No te saltes ninguna sección** aunque "no haya cambiado nada": los rechazos más comunes vienen de metadata y privacidad, no del código.
2. Para cada ❌, decide entre arreglarlo antes del build o explicarlo en las notas al reviewer ([docs/store/app-store-metadata.md](../../../docs/store/app-store-metadata.md)).
3. Reporta a Diana una tabla `item | estado | evidencia (archivo:línea o comando) | acción`.
4. Nunca rellenes ni commitees en `oss/public` los IDs de Apple (`appleId`, `ascAppId`, `appleTeamId`). Ver la frontera de sanitización en la memoria `branch-structure-oss`.

## 0. Toolchain y build (rechazo automático en upload)

- [ ] Compila con **Xcode 26+ / iOS 26 SDK** (obligatorio desde el 28 abr 2026). En EAS: el perfil `production` usa una imagen con Xcode 26 (`eas.json` → `build.production.ios.image`, o el default del SDK de Expo).
- [ ] `version`/`nativeBuild` se sincronizaron (`npm run version:check`) y el `buildNumber` es mayor que el último subido a ASC.
- [ ] El ícono 1024 no tiene canal alfa (ITMS-90717): `sips -g hasAlpha assets/icon.png` → `no`.
- [ ] `ITSAppUsesNonExemptEncryption: false` está en `app.json` (evita la pregunta de export compliance).
- [ ] **Privacy manifests:** el `.ipa` contiene `PrivacyInfo.xcprivacy` de la app y de cada SDK de la lista de Apple (Sentry, PostHog, expo-*). Verifícalo descomprimiendo el `.ipa` y corriendo `find Payload -name PrivacyInfo.xcprivacy`. Lo que declaran tiene que coincidir con App Privacy en ASC (§5).
- [ ] Ningún módulo nativo de dev en el build de producción (`expo-dev-client` no se activa en release, sin menú dev).

## 1. Completitud y acceso para el reviewer (2.1)

- [ ] El reviewer puede usar **todas** las funciones sin cuenta de Notion: botón visible "Explorar con datos de ejemplo" en el onboarding → modo demo (Luna y Mar con ciclo, Sol sin ciclo) que cubre Inicio, Stock, Comidas, Salud y Perfil.
- [ ] Las notas al reviewer (en inglés) explican: qué es Notion y por qué se pide un token de integración; cómo entrar al modo demo; que HealthKit es opcional y la app funciona sin datos de Salud; que no hay cuentas, compras ni backend propio (salvo sharedStock, si sigue activo; explicar qué hace).
- [ ] Si Apple pide probar con Notion real: tener lista una workspace de prueba con el template y un token **de solo esa workspace** para pegar en las notas (nunca el workspace personal).
- [ ] Sin placeholders, "TODO", "lorem", pantallas vacías ni crashes en el primer arranque (probar instalación limpia + modo avión).
- [ ] Stock compartido: el build de EAS **no** recibe `BACKEND_API_KEY`, así que `usesSharedStockBackend()` es false y los suplementos «Compartido» guardan stock local. Si alguna vez se activa el backend en un build público, hay que declararlo en PRIVACY.md y en App Privacy (servidor propio con datos de stock).

## 2. Salud y seguridad médica (1.4.1, 1.4.2, 5.1.3)

- [ ] **Disclaimer médico dentro de la app** (Perfil, onboarding o la pantalla de suplementos): "La Comuna no es un dispositivo médico ni sustituye consejo profesional. Consulta a tu médica antes de cambiar tus suplementos." También en la descripción de la tienda.
- [ ] La app no recomienda **dosis**. Muestra lo que la usuaria anotó en su Notion; el texto no debe decir que la app prescribe nada (1.4.2).
- [ ] La estimación de fase o ciclo explica su método donde se muestra: mediana de los ciclos de HealthKit, rango de 21 a 45 días, fallback de 28 días. Nada de "predicción de fertilidad" ni promesas de exactitud (1.4.1).
- [ ] Escritura en HealthKit = solo nutrientes, **opt-in por perfil** (Perfil → Apple Salud), con borrado al desmarcar y sin escribir nada ambiguo (`parseNutrients` exige cantidad + unidad). `NSHealthUpdateUsageDescription` debe describir exactamente eso; las notas al reviewer lo explican. Si se agrega otra escritura, actualizar los tres.
- [ ] Solo se piden los tipos de HealthKit que se usan de verdad (5.1.1(iii)): revisa la lista `toRead` contra lo que muestran Inicio y Salud.
- [ ] La UI identifica HealthKit / Apple Salud de forma clara (2.5.1) y la app funciona si la usuaria niega el permiso (5.1.1(iv)).
- [ ] La «energía de hoy» se presenta como orientativa, con su método a un toque (1.4.1), y solo lee sueño del teléfono.
- [ ] Ningún dato de salud va a iCloud (5.1.3(ii)): ni CloudKit, ni iCloud Drive. Riesgo bajo: la SQLite con `cycle_states` entra al backup del dispositivo; si Apple lo objeta, excluirla del backup.

## 3. Privacidad y datos (5.1.1, 5.1.2)

- [ ] **Link a la política de privacidad dentro de la app** (Perfil → "Privacidad") que apunte a la URL canónica de `docs/PRIVACY.md`, y la misma URL en ASC. Es obligatorio en ambos lugares.
- [ ] Los usage strings de HealthKit dicen la verdad. Si la fase calculada con HealthKit se sincroniza a Notion (`updatePhase` en `useHealthData`), **no** pueden decir "estos datos no salen de tu dispositivo". Algo como: "…Los datos de Salud se quedan en tu dispositivo; solo la fase calculada puede guardarse en tu propio Notion."
- [ ] **Consentimiento de analítica** (5.1.1(ii) exige consentimiento incluso si los datos son anónimos): un switch en Perfil para PostHog (`optIn`/`optOut`) y Sentry, y la política explica cómo desactivarlos.
- [ ] Sentry: `sendDefaultPii` en `false` (o declarar IP e identificadores en App Privacy). `beforeSend`/`beforeBreadcrumb` no deben dejar pasar datos de salud: ni fechas de ciclo, ni fase, ni suplementos, ni logs de consola con datos de Salud (`enableLogs: true`).
- [ ] PostHog: `autocapture={false}`, sin session replay. Las props de los eventos no llevan fase, ciclo, síntomas ni nombres de suplementos (5.1.2(vi)). Para revisarlo: `grep -rn "capture(" src` y leer las props.
- [ ] Sin tracking entre apps: no se usa IDFA, así que no hace falta ATT. Si se agrega cualquier SDK de ads o attribution, re-evaluar.
- [ ] El token de Notion solo vive en SecureStore/Keychain y nunca aparece en logs, Sentry ni PostHog (1.6).
- [ ] Borrado de datos: no hay cuentas (5.1.1(v) no aplica), pero "Desconectar Notion" borra el token y los IDs. Considerar "Borrar datos locales" para la caché SQLite.

## 4. Negocio: donaciones y links externos (3.1.1, 3.1.3, 3.2.2)

- [ ] **Nada** dentro de la app pide donaciones, Sponsors, "apóyanos" ni propinas. Apple solo permite recaudar dentro de la app a organizaciones sin fines de lucro aprobadas, y las propinas digitales van por IAP.
- [ ] El link a GitHub de Perfil se presenta como "código abierto", no como donación. Riesgo: si el README o la página del repo muestra un botón Sponsor muy visible, un reviewer estricto puede leerlo como un pago externo. Alternativa segura: que apunte a la política o la documentación.
- [ ] Ninguna función se desbloquea con un token, una clave o un estado de patrocinio (3.1.1).

## 5. Metadata de App Store Connect (2.3, 5.1)

- [ ] **Age rating 18+** (decisión oct 2026) con el cuestionario nuevo (sistema 4+/9+/13+/16+/18+ desde 2025). Responder honestamente «Medical or Treatment-Focused Content» y «Health or Wellness Topics», y fijar la edad mínima en 18+. Debe coincidir con `docs/store/app-store-metadata.md` y `docs/PRIVACY.md`.
- [ ] Las respuestas de App Privacy coinciden con el código y los privacy manifests: Crash Data y Performance (Sentry), Product Interaction (PostHog), Device ID / Other Identifiers (`identify(profile_x)`, IP si `sendDefaultPii`), todo "Not linked to identity" y "Not used for tracking". Health: no se recolecta en servidores.
- [ ] Screenshots de la app en uso, en modo demo, sin datos personales reales. Hacen falta las de 6.9" y, si `supportsTablet: true`, también las de iPad 13". Sin splash ni onboarding como captura principal (2.3.3).
- [ ] La descripción y las keywords no mencionan Android ni otras plataformas (2.3.10), no tienen keywords irrelevantes o de competidores (2.3.7) y no hacen promesas médicas.
- [ ] Hay URL de soporte y contacto válidos (1.5). Para la Support URL basta el repo o una página de contacto.
- [ ] Categoría Health & Fitness.
- [ ] Copyright y nombre de la app iguales a los de la pantalla de inicio.

## 6. Diseño y funcionalidad mínima (4.x)

- [ ] La app aporta valor propio más allá de Notion: registro diario, stock, fases con HealthKit, recordatorios (4.2). Menciónalo en las notas.
- [ ] Si `supportsTablet: true`: la UI no se rompe en iPad (rotación, safe areas, split view). Si no vas a probar iPad, pon `supportsTablet: false`.
- [ ] Las notificaciones locales piden permiso en contexto (al activar recordatorios), no en el primer arranque, y no se usan para marketing (4.5.4).
- [ ] Sin funciones ocultas ni flags de dev accesibles en release (2.5.19), y sin código descargado que cambie el comportamiento (2.5.2).

## 7. Después del submit

- [ ] Si llega un rechazo: copia la guideline citada, búscala en este checklist y, si no estaba cubierta, **agrégala aquí** con la lección aprendida.
- [ ] Responde en el Resolution Center antes de re-subir cuando sea un malentendido (por ejemplo, explicar el modo demo o el token de Notion).
