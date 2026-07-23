# Config de Notion en runtime (onboarding multi-workspace)

## Contexto

Para publicar la app en el App Store, cualquier usuaria debe poder conectarla a **su propio workspace de Notion** sin compilar: pega el token de su integración interna y la app descubre el template duplicado. `.env` sigue funcionando como fallback para forks y desarrollo.

## Piezas

| Pieza          | Archivo                                                  | Responsabilidad                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings       | `src/config/notionSettings.ts`                           | Cascada **guardado en dispositivo → `.env` → none**. Token en SecureStore (llavero), IDs en AsyncStorage. Snapshot sync en memoria hidratado en el boot (`loadNotionSettings`).                                                                                                                                                                                         |
| Cliente        | `src/api/notion.ts`                                      | Sin constantes de módulo: cada llamada resuelve `getNotionSettings()`. `withNotionApiKey` permite ejercitar el cliente con un token aún no guardado (onboarding).                                                                                                                                                                                                       |
| Descubrimiento | `src/api/notion.ts` + `src/utils/notionTemplateMatch.ts` | `discoverNotionTemplate(token)`: search API → matcher puro por títulos (DB _Suplementos_, BD _Tés_, páginas candidatas _Fases_/_Comidas–Cocina_) → verificación estructural (tabla inline con ≥3 columnas; heading `Comidas Activas`). Devuelve también las **personas** de la tabla de fases. `verifyManualNotionIds` valida IDs pegados a mano con el mismo contrato. |
| Hook           | `src/hooks/useNotionConnection.ts`                       | Orquesta conectar (auto/manual): valida token (`/users/me`), descubre/verifica, persiste settings y aplica overrides de perfil. Errores mapeados a mensajes accionables (401, 403/404).                                                                                                                                                                                 |
| Onboarding     | `src/screens/NotionOnboarding.tsx`                       | Gate previo al picker de perfil cuando `source === 'none'`: pasos (template → integración → compartir → token), input de token, detección automática y fallback de IDs manuales.                                                                                                                                                                                        |
| Perfiles       | `src/config/profiles.ts`                                 | Overrides **runtime** (AsyncStorage `profile_overrides_v1`) con prioridad `profiles.local.ts` (build) > runtime > defaults. `overridesFromPhaseRowLabels` mapea filas detectadas a slots. Suscripción para re-render (`subscribeProfileOverrides`).                                                                                                                     |
| Perfil (UI)    | `src/screens/Profile.tsx`                                | Sección **Conexión Notion** (estado, desconectar → borra token y vuelve al onboarding) y edición de nombre mostrado + persona en Notion por perfil.                                                                                                                                                                                                                     |

## Reglas

- La BD de Tés del maintainer (hardcodeada) solo se usa como fallback cuando la config viene de `.env`; con settings guardados se usa el `teasDbId` detectado o no hay tés.
- `SupplementPersona` es `string` (nombres libres por workspace); `'Ambas'` sigue siendo la opción compartida del template.
- Desconectar **no** toca datos en Notion ni el SQLite local; solo borra token/IDs del dispositivo.

## QA manual

1. Sin `.env` y sin settings → arranca en onboarding; token válido detecta template y pasa al picker con nombres reales de la tabla de fases.
2. Con `.env` completo y sin settings guardados → arranca directo (source `env`), comportamiento idéntico al histórico.
3. Perfil → Desconectar Notion → vuelve el onboarding; reconectar re-mapea perfiles.
