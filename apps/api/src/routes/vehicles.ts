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

export function createVehicleRouter(vehicleService: VehicleService): ExpressRouter {
  const router = Router();

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
