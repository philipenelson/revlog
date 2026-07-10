import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { upsertInsuranceSchema } from '@maintenance-log/contracts';
import type { InsuranceService } from '../../../application/services/insurance.service';
import { authenticate } from '../middleware/auth';

export function createInsuranceRouter(insuranceService: InsuranceService): ExpressRouter {
  // mergeParams: true so req.params.vehicleId is available (set by the parent router).
  const router = Router({ mergeParams: true });

  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId } = req.params as { vehicleId: string };
      const insurance = await insuranceService.getInsurance(vehicleId, req.auth!.accountId);
      res.status(200).json({ insurance });
    } catch (err) {
      next(err);
    }
  });

  router.put('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = upsertInsuranceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const { vehicleId } = req.params as { vehicleId: string };
      const insurance = await insuranceService.upsertInsurance(vehicleId, req.auth!.accountId, parsed.data);
      res.status(200).json({ insurance });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId } = req.params as { vehicleId: string };
      await insuranceService.deleteInsurance(vehicleId, req.auth!.accountId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
