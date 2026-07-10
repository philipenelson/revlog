import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { createVehicleSchema, updateVehicleSchema, initiateTransferSchema } from '@maintenance-log/domain';
import type { Vehicle, VehicleDetail } from '../domain';
import type { VehicleService } from '../services/vehicle.service';
import type { VehicleTransferService } from '../services/vehicle-transfer.service';
import { authenticate } from '../middleware/auth';
import { vehiclePhotoUpload } from '../lib/upload';

function buildPhotoUrl(req: Request, photoPath: string | null): string | null {
  if (!photoPath) return null;
  return `${req.protocol}://${req.get('host')}/uploads/vehicles/${photoPath}`;
}

function toVehicleResponse(req: Request, vehicle: Vehicle) {
  return {
    id: vehicle.id,
    nickname: vehicle.nickname,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    mileage: vehicle.mileage,
    photoUrl: buildPhotoUrl(req, vehicle.photoPath),
  };
}

function toVehicleDetailResponse(req: Request, detail: VehicleDetail) {
  return {
    id: detail.id,
    nickname: detail.nickname,
    make: detail.make,
    model: detail.model,
    year: detail.year,
    mileage: detail.mileage,
    photoUrl: buildPhotoUrl(req, detail.photoPath),
    insurance: detail.insurance,
    logEntries: detail.logEntries,
    stats: detail.stats,
    transferPending: detail.transferPending,
    pendingTransfer: detail.pendingTransfer,
  };
}

function toVehicleListItemResponse(req: Request, vehicle: Vehicle & { logEntryCount: number }) {
  return { ...toVehicleResponse(req, vehicle), logEntryCount: vehicle.logEntryCount };
}

export function createVehicleRouter(vehicleService: VehicleService, transferService: VehicleTransferService): ExpressRouter {
  const router = Router();

  router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await vehicleService.getDetail(String(req.params['id']), req.auth!.accountId);
      res.status(200).json({ vehicle: toVehicleDetailResponse(req, detail) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const vehicleId = String(req.params['id']);
    if (!vehicleId) {
      res.status(400).json({ error: 'Vehicle ID is required' });
      return;
    }
    try {
      await vehicleService.deleteVehicle(vehicleId, req.auth!.accountId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = updateVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
      return;
    }
    try {
      const vehicle = await vehicleService.updateVehicle(
        String(req.params['id']),
        req.auth!.accountId,
        parsed.data,
      );
      res.status(200).json({ vehicle: toVehicleResponse(req, vehicle) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await vehicleService.listVehicles(req.auth!.accountId);
      res.status(200).json({ vehicles: vehicles.map((v) => toVehicleListItemResponse(req, v)) });
    } catch (err) {
      next(err);
    }
  });

  // Accepts multipart/form-data (photo field optional) or application/json (no photo).
  // Multer is a no-op for JSON requests.
  router.post(
    '/',
    authenticate,
    vehiclePhotoUpload,
    async (req: Request, res: Response, next: NextFunction) => {
      const parsed = createVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
        return;
      }
      try {
        const photoPath = req.file?.filename ?? null;
        const vehicle = await vehicleService.createVehicle(req.auth!.accountId, parsed.data, photoPath);
        res.status(201).json({ vehicle: toVehicleResponse(req, vehicle) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/photo',
    authenticate,
    vehiclePhotoUpload,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.file) {
        res.status(400).json({ error: 'No photo file provided' });
        return;
      }
      try {
        const vehicle = await vehicleService.setVehiclePhoto(
          String(req.params['id']),
          req.auth!.accountId,
          req.file.filename,
        );
        res.status(200).json({ photoUrl: buildPhotoUrl(req, vehicle.photoPath) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post('/:id/transfer', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = initiateTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
      return;
    }
    try {
      const transfer = await transferService.initiate(
        String(req.params['id']),
        req.auth!.accountId,
        req.auth!.sub,
        parsed.data.recipientEmail,
      ); // sub is the userId from JWT
      res.status(201).json({
        transfer: {
          id: transfer.id,
          status: transfer.status,
          recipientEmail: transfer.recipientEmail,
          expiresAt: transfer.expiresAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/transfer', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transferService.cancel(String(req.params['id']), req.auth!.accountId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
