import { Router, Request, Response } from 'express';
import { DataExportService } from './DataExportService';

const router = Router();

const getUserId = (req: Request): string | undefined => {
  const u = (req as unknown as { user?: { id?: string } }).user;
  if (u?.id) return u.id;
  const fromQuery = Array.isArray(req.query.userId)
    ? req.query.userId[0]
    : req.query.userId;
  if (typeof fromQuery === 'string' && fromQuery.length) return fromQuery;
  const bodyUserId = (req.body as { userId?: string } | undefined)?.userId;
  return typeof bodyUserId === 'string' && bodyUserId.length
    ? bodyUserId
    : undefined;
};

router.get('/metadata', (_req: Request, res: Response) => {
  res.json({
    schemaVersion: 1,
    categories: {
      profile: true,
      contacts: true,
      transactionHistory: true,
    },
    idFields: {
      profile: ['id'],
      contacts: ['id'],
      transactionHistory: ['id', 'correlationId'],
    },
    canonicalAmountFields: {
      transactionHistory: [
        'metadata.canonicalAmount',
        'metadata.canonicalMinDestAmount',
      ],
    },
  });
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const svc = new DataExportService();
    const data = await svc.exportUserProfile(userId);
    return res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'export_failed', message });
  }
});

export default router;
