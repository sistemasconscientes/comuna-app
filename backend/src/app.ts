import express, { type NextFunction, type Request, type Response } from 'express';
import { requireApiKey } from './middleware/apiKey';
import stockRoutes from './routes/stock';

/** App Express sin conexión a Mongo (la abre `server.ts`); separada para poder probarla. */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  // El body se parsea solo tras validar la API key: sin key no se lee nada del request.
  app.use('/stock', requireApiKey, express.json({ limit: '10kb' }), stockRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  // Sin stack traces hacia el cliente (el handler por defecto de Express los manda si NODE_ENV≠production).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number; statusCode?: number }).status ?? 500;
    if (status >= 500) console.error(err);
    const client = status === 413 ? 'payload too large' : status < 500 ? 'bad request' : 'internal error';
    res.status(status).json({ error: client });
  });

  return app;
}
