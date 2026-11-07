import { createHash, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Requiere header `x-api-key` igual a `process.env.API_KEY` (comparación en tiempo constante). */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.API_KEY;
  const provided = req.headers['x-api-key'];
  const key = Array.isArray(provided) ? provided[0] : provided;

  if (!expected || !key || !timingSafeEqual(digest(key), digest(expected))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
