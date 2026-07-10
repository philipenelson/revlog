import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { createVehicleRouter } from './vehicles';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../lib/tokens';
import type { VehicleService } from '../services/vehicle.service';
import type { VehicleTransferService } from '../services/vehicle-transfer.service';
import type { Vehicle, VehicleDetail, VehicleInsurance } from '../domain';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

// Replaces multer's disk-storage middleware so route tests stay unit-scoped.
// Tests that want a "file present" scenario call setMockFile(); others leave it unset.
let mockFileForNextRequest: Express.Multer.File | undefined;
function setMockFile(file: Partial<Express.Multer.File> = {}) {
  mockFileForNextRequest = {
    fieldname: 'photo',
    originalname: 'bike.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    filename: 'test-photo.jpg',
    path: '/tmp/test-photo.jpg',
    size: 1024,
    destination: '/tmp',
    buffer: Buffer.alloc(0),
    ...file,
  } as Express.Multer.File;
}

vi.mock('../lib/upload', () => ({
  UPLOADS_DIR: '/tmp/uploads',
  vehiclePhotoUpload: (req: Request, _res: Response, next: NextFunction) => {
    if (mockFileForNextRequest) {
      (req as Request & { file?: Express.Multer.File }).file = mockFileForNextRequest;
      mockFileForNextRequest = undefined;
    }
    next();
  },
}));

const mockVehicleService: Pick<VehicleService, 'createVehicle' | 'listVehicles' | 'setVehiclePhoto' | 'getDetail' | 'updateVehicle' | 'deleteVehicle'> = {
  createVehicle: vi.fn(),
  listVehicles: vi.fn(),
  setVehiclePhoto: vi.fn(),
  getDetail: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
};

const mockTransferService = {
  initiate: vi.fn(),
  cancel: vi.fn(),
  getTransferDetails: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
} as unknown as VehicleTransferService;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/vehicles', createVehicleRouter(mockVehicleService as VehicleService, mockTransferService));
  app.use(errorMiddleware);
  return app;
}

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockVehicle: Vehicle = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockVehicleWithPhoto: Vehicle = { ...mockVehicle, photoPath: 'abc123.jpg' };

const mockInsurance: VehicleInsurance = {
  company: 'State Farm',
  policyNumber: 'SF-12345',
  startDate: '2025-01-01',
  expiryDate: '2026-12-31',
  premium: '120.00',
  premiumPeriod: 'MONTHLY',
  towNumber: '1-800-555-0100',
  notes: null,
};

const mockLogEntry = {
  id: 'entry-1',
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2025-06-01',
  time: null,
  mileage: 14000,
  itemCount: 2,
  mediaCount: 1,
  totalCost: '45.00',
};

const mockVehicleDetail: VehicleDetail = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
  photoPath: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  insurance: mockInsurance,
  logEntries: [mockLogEntry],
  stats: { totalSpent: '45.00', lastLoggedAt: '2025-06-01' },
  transferPending: false,
  pendingTransfer: null,
};

const validBody = { nickname: 'Daily ride', make: 'Honda', model: 'CB500F', year: 2021, mileage: 14230 };

let authHeader: string;

beforeAll(async () => {
  const { token } = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
});

describe('GET /vehicles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).get('/vehicles');

    expect(res.status).toBe(401);
    expect(mockVehicleService.listVehicles).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is invalid', async () => {
    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(mockVehicleService.listVehicles).not.toHaveBeenCalled();
  });

  it('returns 200 with photoUrl null when the vehicle has no photo', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockVehicle, logEntryCount: 0 },
    ]);

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      vehicles: [
        {
          id: mockVehicle.id,
          nickname: mockVehicle.nickname,
          make: mockVehicle.make,
          model: mockVehicle.model,
          year: mockVehicle.year,
          mileage: mockVehicle.mileage,
          photoUrl: null,
          logEntryCount: 0,
        },
      ],
    });
  });

  it('returns the real logEntryCount reported by the service', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockVehicle, logEntryCount: 5 },
    ]);

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.vehicles[0].logEntryCount).toBe(5);
  });

  it('returns a constructed photoUrl when the vehicle has a photo', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockVehicleWithPhoto, logEntryCount: 0 },
    ]);

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.vehicles[0].photoUrl).toMatch(/\/uploads\/vehicles\/abc123\.jpg$/);
  });

  it('calls vehicleService.listVehicles with the accountId from the access token', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...mockVehicle, logEntryCount: 0 },
    ]);

    await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(mockVehicleService.listVehicles).toHaveBeenCalledOnce();
    expect(mockVehicleService.listVehicles).toHaveBeenCalledWith('account-1');
  });

  it('returns 200 and an empty list for an account with no vehicles', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ vehicles: [] });
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });

  it('forwards AppError from the service to the error middleware', async () => {
    (mockVehicleService.listVehicles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(400, 'Something went wrong'),
    );

    const res = await supertest(buildApp()).get('/vehicles').set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Something went wrong' });
  });
});

describe('POST /vehicles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).post('/vehicles').send(validBody);

    expect(res.status).toBe(401);
    expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is invalid', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
  });

  it('returns 201 and the created vehicle with photoUrl null when no photo is uploaded', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    const res = await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ vehicle: expect.objectContaining({ photoUrl: null }) });
  });

  it('calls createVehicle with photoPath null when no file is uploaded', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp()).post('/vehicles').set('Authorization', authHeader).send(validBody);

    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ make: 'Honda', model: 'CB500F', year: 2021, mileage: 14230 }),
      null,
    );
  });

  it('calls createVehicle with the uploaded filename when a file is present', async () => {
    setMockFile();
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleWithPhoto);

    await supertest(buildApp()).post('/vehicles').set('Authorization', authHeader).send(validBody);

    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ make: 'Honda' }),
      'test-photo.jpg',
    );
  });

  it('forwards a client-supplied id to the service (mobile offline creation, ADR 0027)', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send({ ...validBody, id: 'a1111111-1111-4111-8111-111111111111' });

    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ id: 'a1111111-1111-4111-8111-111111111111' }),
      null,
    );
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send({ ...validBody, id: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
  });

  it('returns 400 and does not call the service when the body fails schema validation', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send({ make: '', model: '', year: 'not-a-year', mileage: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
  });

  it('stores a blank nickname as null', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send({ ...validBody, nickname: '   ' });

    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ nickname: null }),
      null,
    );
  });

  // Regression test: the mobile Add/Edit Vehicle outbox payloads send an
  // already-transformed `nickname: null` (never omit the key) when the
  // Owner leaves it blank -- the schema previously only accepted undefined,
  // which would have rejected the single most common case (no nickname).
  it('accepts an explicit null nickname (mobile outbox payload shape)', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send({ ...validBody, nickname: null });

    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ nickname: null }),
      null,
    );
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).post('/vehicles').set('Authorization', authHeader).send(validBody);

    expect(res.status).toBe(500);
  });

  it('forwards AppError from the service to the error middleware', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(400, 'Something went wrong'),
    );

    const res = await supertest(buildApp()).post('/vehicles').set('Authorization', authHeader).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Something went wrong' });
  });
});

describe('GET /vehicles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).get('/vehicles/vehicle-1');

    expect(res.status).toBe(401);
    expect(mockVehicleService.getDetail).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is invalid', async () => {
    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(mockVehicleService.getDetail).not.toHaveBeenCalled();
  });

  it('returns 200 with the vehicle detail including insurance, logEntries, and stats', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleDetail);

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({
      id: 'vehicle-1',
      make: 'Honda',
      model: 'CB500F',
      insurance: expect.objectContaining({ company: 'State Farm' }),
      logEntries: expect.arrayContaining([expect.objectContaining({ id: 'entry-1' })]),
      stats: expect.objectContaining({ totalSpent: '45.00' }),
    });
  });

  it('returns photoUrl null when the vehicle has no photo', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleDetail);

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.vehicle.photoUrl).toBeNull();
  });

  it('returns a constructed photoUrl when the vehicle has a photo', async () => {
    const detailWithPhoto = { ...mockVehicleDetail, photoPath: 'abc123.jpg' };
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(detailWithPhoto);

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.vehicle.photoUrl).toMatch(/\/uploads\/vehicles\/abc123\.jpg$/);
  });

  it('calls getDetail with the vehicleId from params and accountId from the token', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleDetail);

    await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(mockVehicleService.getDetail).toHaveBeenCalledOnce();
    expect(mockVehicleService.getDetail).toHaveBeenCalledWith('vehicle-1', 'account-1');
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Vehicle not found' });
  });

  it('returns 403 when the service throws a 403 AppError', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockVehicleService.getDetail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).get('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });
});

describe('POST /vehicles/:id/photo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).post('/vehicles/vehicle-1/photo');

    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/photo')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'No photo file provided' });
  });

  it('returns 200 with photoUrl when a photo is uploaded', async () => {
    setMockFile();
    (mockVehicleService.setVehiclePhoto as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleWithPhoto);

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/photo')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toMatch(/\/uploads\/vehicles\/abc123\.jpg$/);
  });

  it('calls setVehiclePhoto with vehicleId from params and accountId from token', async () => {
    setMockFile();
    (mockVehicleService.setVehiclePhoto as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicleWithPhoto);

    await supertest(buildApp()).post('/vehicles/vehicle-1/photo').set('Authorization', authHeader);

    expect(mockVehicleService.setVehiclePhoto).toHaveBeenCalledWith(
      'vehicle-1',
      'account-1',
      'test-photo.jpg',
    );
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    setMockFile();
    (mockVehicleService.setVehiclePhoto as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/photo')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /vehicles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).patch('/vehicles/vehicle-1').send({ make: 'Yamaha' });

    expect(res.status).toBe(401);
    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
  });

  it('returns 200 with the updated vehicle on success', async () => {
    const updated = { ...mockVehicle, make: 'Yamaha' };
    (mockVehicleService.updateVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ make: 'Yamaha' });

    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({ make: 'Yamaha' });
  });

  it('calls updateVehicle with vehicleId from params, accountId from token, and parsed body', async () => {
    (mockVehicleService.updateVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ make: 'Yamaha', year: 2022 });

    expect(mockVehicleService.updateVehicle).toHaveBeenCalledOnce();
    expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
      'vehicle-1',
      'account-1',
      expect.objectContaining({ make: 'Yamaha', year: 2022 }),
    );
  });

  it('returns 400 and does not call the service when the body fails validation', async () => {
    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ year: 'not-a-year' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation error');
    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
  });

  it('returns 400 when an empty body is sent', async () => {
    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(400);
    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
  });

  // Regression test: mobile's Edit Vehicle outbox payload always sends the
  // full field set, including an already-transformed `nickname: null` when
  // cleared -- the schema previously only accepted undefined there too.
  it('accepts an explicit null nickname (mobile outbox payload shape)', async () => {
    (mockVehicleService.updateVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ nickname: null, make: 'Honda', model: 'CB500F', year: 2021, mileage: 14230 });

    expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
      'vehicle-1',
      'account-1',
      expect.objectContaining({ nickname: null }),
    );
  });

  it('returns 403 when the service throws a 403 AppError', async () => {
    (mockVehicleService.updateVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ make: 'Yamaha' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockVehicleService.updateVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1')
      .set('Authorization', authHeader)
      .send({ make: 'Yamaha' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Vehicle not found' });
  });
});

describe('DELETE /vehicles/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).delete('/vehicles/vehicle-1');

    expect(res.status).toBe(401);
    expect(mockVehicleService.deleteVehicle).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is invalid', async () => {
    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(mockVehicleService.deleteVehicle).not.toHaveBeenCalled();
  });

  it('returns 204 on success', async () => {
    (mockVehicleService.deleteVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
  });

  it('calls deleteVehicle with vehicleId from params and accountId from the token', async () => {
    (mockVehicleService.deleteVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await supertest(buildApp()).delete('/vehicles/vehicle-1').set('Authorization', authHeader);

    expect(mockVehicleService.deleteVehicle).toHaveBeenCalledOnce();
    expect(mockVehicleService.deleteVehicle).toHaveBeenCalledWith('vehicle-1', 'account-1');
  });

  it('returns 403 when the service throws a 403 AppError', async () => {
    (mockVehicleService.deleteVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden' });
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockVehicleService.deleteVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Vehicle not found' });
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockVehicleService.deleteVehicle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });
});
