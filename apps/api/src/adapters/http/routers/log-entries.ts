import { Router, type Request, type Response, type NextFunction } from 'express';
import { createLogEntrySchema, updateLogEntrySchema } from '@maintenance-log/domain';
import type { LogEntryService } from '../../../application/services/log-entry.service';
import { authenticate } from '../middleware/auth';

export function createLogEntryRouter(logEntryService: LogEntryService): Router {
  const router = Router({ mergeParams: true }); // mergeParams to get vehicleId from parent

  // POST /vehicles/:vehicleId/log
  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createLogEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const vehicleId = String(req.params['vehicleId']);
      const entry = await logEntryService.create(vehicleId, req.auth!.accountId, parsed.data);
      res.status(201).json({ logEntry: entry });
    } catch (err) {
      next(err);
    }
  });

  // GET /vehicles/:vehicleId/log
  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicleId = String(req.params['vehicleId']);
      const typeId = req.query['typeId'] ? String(req.query['typeId']) : undefined;
      const entries = await logEntryService.list(vehicleId, req.auth!.accountId, typeId);
      res.status(200).json({ logEntries: entries });
    } catch (err) {
      next(err);
    }
  });

  // GET /vehicles/:vehicleId/log/:entryId
  router.get('/:entryId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicleId = String(req.params['vehicleId']);
      const entryId = String(req.params['entryId']);
      const entry = await logEntryService.getById(vehicleId, req.auth!.accountId, entryId);
      res.status(200).json({ logEntry: entry });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /vehicles/:vehicleId/log/:entryId
  router.patch('/:entryId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = updateLogEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const vehicleId = String(req.params['vehicleId']);
      const entryId = String(req.params['entryId']);
      const entry = await logEntryService.update(vehicleId, req.auth!.accountId, entryId, parsed.data);
      res.status(200).json({ logEntry: entry });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /vehicles/:vehicleId/log/:entryId
  router.delete('/:entryId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicleId = String(req.params['vehicleId']);
      const entryId = String(req.params['entryId']);
      await logEntryService.delete(vehicleId, req.auth!.accountId, entryId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
