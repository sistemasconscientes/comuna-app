import { Router, Request, Response } from 'express';
import { Stock } from '../models/stock';

const router = Router();

type PutBody = {
  bottleOpenedAt?: string | Date;
  totalPills?: number;
  pillsPerDay?: number;
  restockFlagged?: boolean;
};

function parseBottleOpenedAt(value: string | Date | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.get('/:notionId', async (req: Request, res: Response) => {
  const doc = await Stock.findOne({ notionId: req.params.notionId }).lean();
  if (!doc) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.json(doc);
});

router.put('/:notionId', async (req: Request, res: Response) => {
  const notionId = req.params.notionId;
  const body = req.body as PutBody;

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
