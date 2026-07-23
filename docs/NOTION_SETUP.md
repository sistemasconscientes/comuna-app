# Notion — setup rápido

## 1. Template oficial

Clona el template desde el Notion Marketplace:

[Template de La Comuna en Notion Marketplace](https://www.notion.com/es/templates/comuna-app)

El template debe cumplir el contrato en [`../.cursor/rules/notion-api.mdc`](../.cursor/rules/notion-api.mdc) (DB Suplementos, tabla Fases, hub Comidas opcional).

## 2. Integración

1. [Crear integración](https://www.notion.so/my-integrations) (Internal integration).
2. Invitar la integración a las páginas/DB del template clonado.
3. Conectar la app:

**Opción A — en la app (App Store o build propia):** pega el token en el onboarding; la app detecta sola la DB de Suplementos, la página de Fases y el hub de Comidas (search API) y mapea los perfiles con las personas de tu tabla de fases. Si la detección falla, puedes pegar los IDs a mano. Ver [`specs/notion-runtime-settings.md`](specs/notion-runtime-settings.md).

**Opción B — `.env` (desarrollo/fork):** copiar IDs a `.env`:

```env
NOTION_API_KEY=secret_...
NOTION_SUPPLEMENTS_DB_ID=...
NOTION_PHASES_PAGE_ID=...
NOTION_MEAL_PREP_HUB_PAGE_ID=...   # opcional
```

## 3. Alinear perfiles

La app usa `profile_1` y `profile_2`. Con el onboarding in-app los perfiles se mapean solos desde tu tabla de fases (y se editan en Perfil). Para `.env`/forks también puedes fijar labels y mapeo en `src/config/profiles.local.ts` (copiar desde `profiles.local.example.ts`; tiene prioridad sobre lo editado en runtime).

## 4. Debug API

- Reglas del agente: [`.cursor/rules/notion-api.mdc`](../.cursor/rules/notion-api.mdc)
- Meal prep: [`specs/notion-meal-prep.md`](specs/notion-meal-prep.md)
