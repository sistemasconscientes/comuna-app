import { Router, Request, Response } from 'express';
import { Stock } from '../models/stock';

const router = Router();

type PutBody = {
  bottleOpenedAt?: unknown;
  totalPills?: unknown;
  pillsPerDay?: unknown;
  restockFlagged?: unknown;
};

/** IDs de página de Notion: UUID con o sin guiones. Evita upserts con claves arbitrarias. */
const NOTION_ID_RE = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

function isValidNotionId(value: unknown): value is string {
  return typeof value === 'string' && NOTION_ID_RE.test(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** El cliente manda ISO string o `null` (null → epoch, como antes). */
function parseBottleOpenedAt(value: unknown): Date | undefined {
  if (typeof value !== 'string' && value !== null) return undefined;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.get('/:notionId', async (req: Request, res: Response) => {
  if (!isValidNotionId(req.params.notionId)) {
    return res.status(400).json({ error: 'invalid notionId' });
  }
  const doc = await Stock.findOne({ notionId: req.params.notionId }).lean();
  if (!doc) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.json(doc);
});

router.put('/:notionId', async (req: Request, res: Response) => {
  const notionId = req.params.notionId;
  if (!isValidNotionId(notionId)) {
    return res.status(400).json({ error: 'invalid notionId' });
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'invalid body' });
  }
  const body = req.body as PutBody;
  if (body.totalPills !== undefined && !isNonNegativeNumber(body.totalPills)) {
    return res.status(400).json({ error: 'invalid totalPills' });
  }
  if (body.pillsPerDay !== undefined && !isNonNegativeNumber(body.pillsPerDay)) {
    return res.status(400).json({ error: 'invalid pillsPerDay' });
  }
  if (body.restockFlagged !== undefined && typeof body.restockFlagged !== 'boolean') {
    return res.status(400).json({ error: 'invalid restockFlagged' });
  }

  const $set: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.bottleOpenedAt !== undefined) {
    const d = parseBottleOpenedAt(body.bottleOpenedAt);
    if (d === undefined) {
      return res.status(400).json({ error: 'invalid bottleOpenedAt' });
    }
    $set.bottleOpenedAt = d;
  }
  if (body.totalPills !== undefined) $set.totalPills = body.totalPills;
  if (body.pillsPerDay !== undefined) $set.pillsPerDay = body.pillsPerDay;
  if (body.restockFlagged !== undefined) $set.restockFlagged = body.restockFlagged;

  const $setOnInsert: Record<string, unknown> = { notionId };
  if (body.bottleOpenedAt === undefined) {
    $setOnInsert.bottleOpenedAt = new Date();
  }
  if (body.totalPills === undefined) {
    $setOnInsert.totalPills = 0;
  }
  if (body.pillsPerDay === undefined) {
    $setOnInsert.pillsPerDay = 0;
  }
  if (body.restockFlagged === undefined) {
    $setOnInsert.restockFlagged = false;
  }

  try {
    const doc = await Stock.findOneAndUpdate(
      { notionId },
      { $set, $setOnInsert },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    if (!doc) {
      return res.status(500).json({ error: 'update failed' });
    }
    return res.json(doc);
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 11000) {
      return res.status(409).json({ error: 'duplicate key' });
    }
    throw e;
  }
});

export default router;
