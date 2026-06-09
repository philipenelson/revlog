import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { createVehicleSchema, type DomainVehicle, type DomainVehicleDetail } from '@maintenance-log/domain';
import type { VehicleService } from '../services/vehicle.service';
import { authenticate } from '../middleware/auth';
import { vehiclePhotoUpload } from '../lib/upload';

function buildPhotoUrl(req: Request, photoPath: string | null): string | null {
  if (!photoPath) return null;
  return `${req.protocol}://${req.get('host')}/uploads/vehicles/${photoPath}`;
}

function toVehicleResponse(req: Request, vehicle: DomainVehicle) {
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

function toVehicleDetailResponse(req: Request, detail: DomainVehicleDetail) {
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
  };
}

// logEntryCount is a hardcoded placeholder until the LogEntry model exists —
// see garage-list-api.md "Decisions — logEntryCount is a hardcoded placeholder".
function toVehicleListItemResponse(req: Request, vehicle: DomainVehicle) {
  return { ...toVehicleResponse(req, vehicle), logEntryCount: 0 };
}

export function createVehicleRouter(vehicleService: VehicleService): ExpressRouter {
  const router = Router();

  router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await vehicleService.getDetail(String(req.params['id']), req.auth!.accountId);
      res.status(200).json({ vehicle: toVehicleDetailResponse(req, detail) });
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

  return router;
}
