import type { Request, Response, NextFunction } from 'express';

/** Requiere header `x-api-key` igual a `process.env.API_KEY`. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.API_KEY;
  const provided = req.headers['x-api-key'];
  const key = Array.isArray(provided) ? provided[0] : provided;

  if (!expected || key !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
