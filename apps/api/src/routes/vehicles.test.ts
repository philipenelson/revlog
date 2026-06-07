import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createVehicleRouter } from './vehicles';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../lib/tokens';
import type { VehicleService } from '../services/vehicle.service';
import type { DomainVehicle } from '@maintenance-log/domain';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const mockVehicleService: Pick<VehicleService, 'createVehicle'> = {
  createVehicle: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/vehicles', createVehicleRouter(mockVehicleService as VehicleService));
  app.use(errorMiddleware);
  return app;
}

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockVehicle: DomainVehicle = {
  id: 'vehicle-1',
  accountId: 'account-1',
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const validBody = {
  nickname: 'Daily ride',
  make: 'Honda',
  model: 'CB500F',
  year: 2021,
  mileage: 14230,
};

let authHeader: string;

beforeAll(async () => {
  const token = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
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

  it('returns 201 and the created vehicle when the request succeeds', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    const res = await supertest(buildApp())
      .post('/vehicles')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      vehicle: {
        id: mockVehicle.id,
        nickname: mockVehicle.nickname,
        make: mockVehicle.make,
        model: mockVehicle.model,
        year: mockVehicle.year,
        mileage: mockVehicle.mileage,
      },
    });
  });

  it('calls vehicleService.createVehicle with the accountId from the access token and the validated body', async () => {
    (mockVehicleService.createVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(mockVehicle);

    await supertest(buildApp()).post('/vehicles').set('Authorization', authHeader).send(validBody);

    expect(mockVehicleService.createVehicle).toHaveBeenCalledOnce();
    expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ make: 'Honda', model: 'CB500F', year: 2021, mileage: 14230 }),
    );
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
