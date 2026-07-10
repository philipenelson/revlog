import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createInsuranceRouter } from './insurance';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../../../lib/tokens';
import type { InsuranceService } from '../../../application/services/insurance.service';
import type { VehicleInsurance } from '../../../domain';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const mockInsuranceService: Pick<InsuranceService, 'getInsurance' | 'upsertInsurance' | 'deleteInsurance'> = {
  getInsurance: vi.fn(),
  upsertInsurance: vi.fn(),
  deleteInsurance: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/vehicles/:vehicleId/insurance', createInsuranceRouter(mockInsuranceService as InsuranceService));
  app.use(errorMiddleware);
  return app;
}

const mockInsurance: VehicleInsurance = {
  company: 'State Farm',
  policyNumber: 'SF-12345',
  startDate: '2025-01-01',
  expiryDate: '2026-01-01',
  premium: '120.00',
  premiumPeriod: 'MONTHLY',
  towNumber: '1-800-555-0100',
  notes: 'Comprehensive coverage',
};

const validBody = {
  company: 'State Farm',
  policyNumber: 'SF-12345',
  startDate: '2025-01-01',
  expiryDate: '2026-01-01',
  premium: 120,
  premiumPeriod: 'MONTHLY',
  towNumber: '1-800-555-0100',
  notes: 'Comprehensive coverage',
};

let authHeader: string;

beforeAll(async () => {
  const { token } = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
});

describe('GET /vehicles/:vehicleId/insurance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).get('/vehicles/vehicle-1/insurance');

    expect(res.status).toBe(401);
    expect(mockInsuranceService.getInsurance).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is invalid', async () => {
    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(mockInsuranceService.getInsurance).not.toHaveBeenCalled();
  });

  it('returns 200 with the insurance record', async () => {
    (mockInsuranceService.getInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsurance);

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ insurance: mockInsurance });
  });

  it('calls getInsurance with vehicleId from params and accountId from token', async () => {
    (mockInsuranceService.getInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsurance);

    await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(mockInsuranceService.getInsurance).toHaveBeenCalledOnce();
    expect(mockInsuranceService.getInsurance).toHaveBeenCalledWith('vehicle-1', 'account-1');
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockInsuranceService.getInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'No insurance on file'),
    );

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'No insurance on file' });
  });

  it('returns 403 when the service throws a 403 AppError', async () => {
    (mockInsuranceService.getInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockInsuranceService.getInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB exploded'),
    );

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });
});

describe('PUT /vehicles/:vehicleId/insurance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).put('/vehicles/vehicle-1/insurance').send(validBody);

    expect(res.status).toBe(401);
    expect(mockInsuranceService.upsertInsurance).not.toHaveBeenCalled();
  });

  it('returns 400 and does not call the service when the body fails schema validation', async () => {
    const res = await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send({ premiumPeriod: 'NOT_VALID', premium: -10 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(mockInsuranceService.upsertInsurance).not.toHaveBeenCalled();
  });

  it('returns 200 with the upserted insurance record', async () => {
    (mockInsuranceService.upsertInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsurance);

    const res = await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ insurance: mockInsurance });
  });

  it('calls upsertInsurance with vehicleId, accountId, and parsed input', async () => {
    (mockInsuranceService.upsertInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsurance);

    await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(mockInsuranceService.upsertInsurance).toHaveBeenCalledOnce();
    expect(mockInsuranceService.upsertInsurance).toHaveBeenCalledWith(
      'vehicle-1',
      'account-1',
      expect.objectContaining({ company: 'State Farm', premiumPeriod: 'MONTHLY' }),
    );
  });

  it('accepts an empty body and passes all-null input to the service', async () => {
    (mockInsuranceService.upsertInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsurance);

    const res = await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(200);
    expect(mockInsuranceService.upsertInsurance).toHaveBeenCalledWith(
      'vehicle-1',
      'account-1',
      expect.objectContaining({ company: null }),
    );
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockInsuranceService.upsertInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it('returns 403 when the service throws a 403 AppError', async () => {
    (mockInsuranceService.upsertInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .put('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader)
      .send(validBody);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /vehicles/:vehicleId/insurance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).delete('/vehicles/vehicle-1/insurance');

    expect(res.status).toBe(401);
    expect(mockInsuranceService.deleteInsurance).not.toHaveBeenCalled();
  });

  it('returns 204 on successful deletion', async () => {
    (mockInsuranceService.deleteInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('calls deleteInsurance with vehicleId from params and accountId from token', async () => {
    (mockInsuranceService.deleteInsurance as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await supertest(buildApp())
      .delete('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(mockInsuranceService.deleteInsurance).toHaveBeenCalledOnce();
    expect(mockInsuranceService.deleteInsurance).toHaveBeenCalledWith('vehicle-1', 'account-1');
  });

  it('returns 404 when the service throws a 404 AppError', async () => {
    (mockInsuranceService.deleteInsurance as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'No insurance on file'),
    );

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1/insurance')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'No insurance on file' });
  });
});
