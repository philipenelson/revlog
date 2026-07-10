import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import type { VehicleTransferService } from '../../../application/services/vehicle-transfer.service';
import { authenticate } from '../middleware/auth';

function buildPhotoUrl(req: Request, photoPath: string | null): string | null {
  if (!photoPath) return null;
  return `${req.protocol}://${req.get('host')}/uploads/vehicles/${photoPath}`;
}

export function createTransferRouter(transferService: VehicleTransferService): ExpressRouter {
  const router = Router();

  router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await transferService.getTransferDetails(
        String(req.params['token']),
        (path) => buildPhotoUrl(req, path),
      );
      res.status(200).json({ transfer: details });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:token/accept', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicleId = await transferService.accept(
        String(req.params['token']),
        req.auth!.accountId,
      );
      res.status(200).json({ vehicleId });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:token/decline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transferService.decline(String(req.params['token']));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
