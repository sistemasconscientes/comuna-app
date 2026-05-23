# Notion — setup rápido

## 1. Template oficial

Clona el template desde el Notion Marketplace:

**`NOTION_TEMPLATE_MARKETPLACE_URL`** *(sustituir cuando publiques el listing)*

El template debe cumplir el contrato en [`../.cursor/rules/notion-api.mdc`](../.cursor/rules/notion-api.mdc) (DB Suplementos, tabla Fases, hub Comidas opcional).

## 2. Integración

1. [Crear integración](https://www.notion.so/my-integrations) (Internal integration).
2. Invitar la integración a las páginas/DB del template clonado.
3. Copiar IDs a `.env`:

```env
NOTION_API_KEY=secret_...
NOTION_SUPPLEMENTS_DB_ID=...
NOTION_PHASES_PAGE_ID=...
NOTION_MEAL_PREP_HUB_PAGE_ID=...   # opcional
```

## 3. Alinear perfiles

La app usa `profile_1` y `profile_2`. Por defecto mapean a **Diana** / **Estefanía** en Notion. Personaliza labels y mapeo en `src/config/profiles.local.ts` (copiar desde `profiles.local.example.ts`).

## 4. Debug API

- Reglas del agente: [`.cursor/rules/notion-api.mdc`](../.cursor/rules/notion-api.mdc)
- Meal prep: [`specs/notion-meal-prep.md`](specs/notion-meal-prep.md)
