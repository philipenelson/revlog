import { Router, type Request, type Response, type NextFunction } from 'express';
import type { VehicleReportService } from '../services/vehicle-report.service';
import { authenticate } from '../middleware/auth';
import { reportEmailSchema } from '@maintenance-log/domain';

function buildPhotoUrl(req: Request, photoPath: string | null): string | null {
  if (!photoPath) return null;
  return `${req.protocol}://${req.get('host')}/uploads/vehicles/${photoPath}`;
}

export function createReportRouter(reportService: VehicleReportService): Router {
  const router = Router();

  // Public — no auth
  router.get('/:shareToken', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const printout = await reportService.getByShareToken(String(req.params['shareToken']));
      if (!printout) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const photoUrl = buildPhotoUrl(req, printout.vehicle.photoUrl);
      res.status(200).json({
        ...printout,
        vehicle: { ...printout.vehicle, photoUrl },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createVehicleReportTokenRouter(reportService: VehicleReportService): Router {
  const router = Router({ mergeParams: true });

  // GET /vehicles/:vehicleId/report-token — check if active token exists
  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.getActiveToken(
        String(req.params['vehicleId']),
        req.auth!.accountId,
      );
      if (!result) {
        res.status(200).json({ shareToken: null, shareUrl: null });
        return;
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /vehicles/:vehicleId/report-token — create/replace token
  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.createToken(
        String(req.params['vehicleId']),
        req.auth!.accountId,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /vehicles/:vehicleId/report-token — revoke token
  router.delete('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await reportService.revokeToken(
        String(req.params['vehicleId']),
        req.auth!.accountId,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /vehicles/:vehicleId/report-token/email — send email
  router.post('/email', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = reportEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
      return;
    }
    try {
      await reportService.emailLink(
        String(req.params['vehicleId']),
        req.auth!.accountId,
        parsed.data.email,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
