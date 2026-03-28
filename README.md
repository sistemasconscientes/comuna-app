# Comuna App

App móvil **iOS** de seguimiento de suplementos basada en fases del ciclo menstrual. Sincroniza con Notion como fuente de verdad y guarda los datos localmente con SQLite.

## Stack

- **React Native** + **Expo** SDK 55
- **TypeScript**
- **SQLite** local con **Drizzle ORM**
- **Notion API** como base de datos de suplementos y fases del ciclo

## Setup

```bash
npm install
```

Crear archivo `.env` en la raíz con las siguientes variables:

```env
NOTION_API_KEY=
NOTION_SUPPLEMENTS_DB_ID=
NOTION_PHASES_PAGE_ID=
# Opcional: pestaña Comidas / meal prep (página con heading "Comidas Activas")
NOTION_MEAL_PREP_HUB_PAGE_ID=
# Opcional (solo __DEV__): evita updatePhase en Notion al probar otro perfil sin pisar su fila de fases
# NOTION_SKIP_PHASE_WRITE=true

# Stock compartido (Persona Ambas): URL del backend Express — en iPhone en la misma WiFi que el Mac, usar IP LAN (ver npm run start:device)
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.0:3000
BACKEND_API_KEY=

# Opcional: PostHog (eventos de producto)
# POSTHOG_API_KEY=
# POSTHOG_HOST=https://us.i.posthog.com

# Opcional: Sentry (errores) — ver docs/specs/posthog-analytics.md
# SENTRY_DSN=

# Opcional: en release sin __DEV__, etiqueta preview|production (EAS lo define en eas.json)
# EXPO_PUBLIC_APP_ENV=preview
```

Correr la app:

```bash
expo start        # Dev server
expo run:ios      # Simulador / dispositivo iOS
```

## Estructura

```
src/
├── api/
│   ├── notion.ts          # Cliente Notion — suplementos, fases (tabla inline), recompra
│   └── healthkit.ts       # iOS: Salud — última menstruación (dev build)
├── context/
│   └── UserContext.tsx    # Contexto de usuario activo (diana | estefania)
├── db/
│   ├── schema.ts          # Tablas: supplements, dailyLogs, stock (restock_flagged), phases, cycle_states
│   ├── index.ts           # Inicialización de la DB
│   └── migrations/        # Migraciones generadas por drizzle-kit
├── hooks/
│   ├── useSupplements.ts  # Lógica de suplementos (sync Notion → SQLite)
│   ├── useDailyLog.ts     # Registro diario de tomas
│   ├── useStock.ts        # Gestión de inventario
│   └── useHealthData.ts   # Datos del ciclo menstrual
├── screens/
│   ├── Home.tsx           # Pantalla principal (suplementos del día)
│   ├── MealPrep.tsx       # Pestaña Comidas
│   ├── DailyLogByDate.tsx # Tomas por fecha (desde Perfil)
│   ├── Stock.tsx          # Vista de inventario
│   └── Profile.tsx        # Usuario activo y fase
├── types/
│   └── index.ts           # Interfaces y tipos compartidos
└── utils/
    ├── phaseCalculator.ts # Cálculo de fase actual según fecha
    └── phaseUtils.ts      # Normalización de nombres de fases
```

## Sync con Notion

Al iniciar, la app consulta Notion para:

1. **Suplementos** — desde `NOTION_SUPPLEMENTS_DB_ID`, filtrados por usuario y disponibilidad
2. **Fase actual** — desde `NOTION_PHASES_PAGE_ID`, tabla inline con fase (texto + emoji) y próximo ciclo por usuario

En **iOS** con datos de Salud, la app puede **escribir** de vuelta en esa tabla vía `updatePhase` cuando la fase calculada difiere de Notion (ver `docs/specs/healthkit-cycle-sync.md`). En desarrollo, `NOTION_SKIP_PHASE_WRITE=true` en `.env` desactiva esa escritura solo cuando `__DEV__` es verdadero.

**Stock:** si un suplemento tiene menos de 7 días estimados, se llama una vez a `markForRestock` en Notion por fila (deduplicado con `restock_flagged` en SQLite; ver `docs/specs/stock-restock-notion.md`). El stock **compartido** (suplementos Ambas) usa el backend en MongoDB: definí `EXPO_PUBLIC_BACKEND_URL` y `BACKEND_API_KEY` en `.env`. Desarrollo local: corré `backend/` con `MONGODB_URI` a una base de **prueba**; en dispositivo físico la URL debe ser la **IP de tu Mac** en la LAN, no `localhost`. Los builds **EAS `preview`** llevan la URL de producción interna en [`eas.json`](eas.json) (Render + Mongo **preview** en el servidor); ver `docs/specs/backend-stock-api.md`.

Los datos se persisten en SQLite local (`comuna.db`) para uso offline.

## Scripts

```bash
npm start              # Expo dev server
npm run ios            # Simulador / dispositivo iOS
npm run db:generate    # Generar migraciones tras cambiar schema.ts
npm run db:migrate     # Correr migraciones pendientes
npm run db:studio      # Abrir Drizzle Studio (inspector de DB)
npm test               # Tests con Jest
```

## Usuarios

La app soporta dos perfiles: **Diana** y **Estefanía**. Se seleccionan desde la pantalla Profile. Cada una tiene sus propios suplementos y datos de ciclo en Notion.
