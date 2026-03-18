# Comuna App

App móvil (iOS/Android) de seguimiento de suplementos basada en fases del ciclo menstrual. Sincroniza con Notion como fuente de verdad y guarda los datos localmente con SQLite.

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
```

Correr la app:

```bash
expo start        # Dev server
expo run:ios      # Simulador iOS
expo run:android  # Simulador Android
```

## Estructura

```
src/
├── api/
│   └── notion.ts          # Cliente Notion — fetch de suplementos y fases
├── context/
│   └── UserContext.tsx    # Contexto de usuario activo (diana | estefania)
├── db/
│   ├── schema.ts          # Tablas SQLite: supplements, dailyLogs, stock, phases
│   ├── index.ts           # Inicialización de la DB
│   └── migrations/        # Migraciones generadas por drizzle-kit
├── hooks/
│   ├── useSupplements.ts  # Lógica de suplementos (sync Notion → SQLite)
│   ├── useDailyLog.ts     # Registro diario de tomas
│   ├── useStock.ts        # Gestión de inventario
│   └── useHealthData.ts   # Datos del ciclo menstrual
├── screens/
│   ├── Home.tsx           # Pantalla principal
│   ├── Checklist.tsx      # Checklist diario de suplementos
│   ├── Stock.tsx          # Vista de inventario
│   └── Profile.tsx        # Selector de usuario
├── types/
│   └── index.ts           # Interfaces y tipos compartidos
└── utils/
    ├── phaseCalculator.ts # Cálculo de fase actual según fecha
    └── phaseUtils.ts      # Normalización de nombres de fases
```

## Sync con Notion

Al iniciar, la app consulta Notion para:

1. **Suplementos** — desde `NOTION_SUPPLEMENTS_DB_ID`, filtrados por usuario y disponibilidad
2. **Fase actual** — desde `NOTION_PHASES_PAGE_ID`, una tabla con la fase y próximo ciclo por usuario

Los datos se persisten en SQLite local (`comuna.db`) para uso offline.

## Scripts

```bash
npm start              # Expo dev server
npm run ios            # Simulador iOS
npm run android        # Simulador Android
npm run db:generate    # Generar migraciones tras cambiar schema.ts
npm run db:migrate     # Correr migraciones pendientes
npm run db:studio      # Abrir Drizzle Studio (inspector de DB)
npm test               # Tests con Jest
```

## Usuarios

La app soporta dos perfiles: **Diana** y **Estefanía**. Se seleccionan desde la pantalla Profile. Cada una tiene sus propios suplementos y datos de ciclo en Notion.
