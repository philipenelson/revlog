import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { createVehicleSchema, type DomainVehicle } from '@maintenance-log/domain';
import type { VehicleService } from '../services/vehicle.service';
import { authenticate } from '../middleware/auth';

function toVehicleResponse(vehicle: DomainVehicle) {
  return {
    id: vehicle.id,
    nickname: vehicle.nickname,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    mileage: vehicle.mileage,
  };
}

// logEntryCount is a hardcoded placeholder until the LogEntry model exists —
// see garage-list-api.md "Decisions — logEntryCount is a hardcoded placeholder".
function toVehicleListItemResponse(vehicle: DomainVehicle) {
  return { ...toVehicleResponse(vehicle), logEntryCount: 0 };
}

export function createVehicleRouter(vehicleService: VehicleService): ExpressRouter {
  const router = Router();

  router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicles = await vehicleService.listVehicles(req.auth!.accountId);
      res.status(200).json({ vehicles: vehicles.map(toVehicleListItemResponse) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const parsed = createVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const vehicle = await vehicleService.createVehicle(req.auth!.accountId, parsed.data);
      res.status(201).json({ vehicle: toVehicleResponse(vehicle) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
