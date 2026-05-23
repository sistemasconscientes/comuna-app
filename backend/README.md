# Backend — stock compartido

API Express + MongoDB para inventario de suplementos **Persona Ambas**.

## Quick start

```bash
cd backend
npm install
cp .env.example .env
# Editar MONGODB_URI y API_KEY
npm run dev
```

Con Docker desde la raíz del monorepo:

```bash
docker compose up -d
# MONGODB_URI=mongodb://localhost:27017/comuna en backend/.env
```

## Variables

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | Connection string MongoDB |
| `API_KEY` | Mismo valor que `BACKEND_API_KEY` en la app |
| `PORT` | Default `3000` |
| `appName` | Nombre del driver Mongo (opcional) |

## Spec

Contrato REST y despliegue: [`../docs/specs/backend-stock-api.md`](../docs/specs/backend-stock-api.md).
