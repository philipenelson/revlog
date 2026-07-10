import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createLogEntryRouter } from './log-entries';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../lib/tokens';
import type { LogEntryService } from '../services/log-entry.service';
import type { LogEntry, LogEntrySummary } from '../domain';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockEntry: LogEntry = {
  id: 'entry-1',
  vehicleId: 'vehicle-1',
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
  time: '10:00',
  mileage: 15000,
  notes: 'Used synthetic 5W-30',
  items: [
    {
      id: 'item-1',
      categoryId: 'PART',
      description: 'Oil filter',
      quantity: '1',
      unitCost: '12.50',
      totalCost: '12.50',
      sortOrder: 0,
    },
  ],
  media: [],
  totalCost: '12.50',
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockSummary: LogEntrySummary = {
  id: 'entry-1',
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
  time: '10:00',
  mileage: 15000,
  itemCount: 1,
  mediaCount: 0,
  totalCost: '12.50',
};

const minimalBody = {
  typeId: 'MAINTENANCE',
  title: 'Oil change',
  date: '2026-01-15',
};

const fullBody = {
  ...minimalBody,
  time: '10:00',
  mileage: 15000,
  notes: 'Used synthetic 5W-30',
  items: [{ categoryId: 'PART', description: 'Oil filter', quantity: 1, unitCost: 12.5 }],
  media: [],
};

const mockLogEntryService: Pick<
  LogEntryService,
  'create' | 'list' | 'getById' | 'update' | 'delete'
> = {
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  // Mount with vehicleId param so mergeParams works
  app.use('/vehicles/:vehicleId/log', createLogEntryRouter(mockLogEntryService as LogEntryService));
  app.use(errorMiddleware);
  return app;
}

let authHeader: string;
beforeAll(async () => {
  const { token } = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
});

/* ── POST /vehicles/:vehicleId/log ─────────────────────────────── */

describe('POST /vehicles/:vehicleId/log', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with full entry on happy path with items and media', async () => {
    (mockLogEntryService.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntry);

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send(fullBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ logEntry: { id: 'entry-1', typeId: 'MAINTENANCE' } });
  });

  it('returns 201 on minimal body (type + title + date)', async () => {
    (mockLogEntryService.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntry);

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send(minimalBody);

    expect(res.status).toBe(201);
  });

  it('returns 400 when typeId is missing', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send({ title: 'Oil change', date: '2026-01-15' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(mockLogEntryService.create).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send({ typeId: 'MAINTENANCE', date: '2026-01-15' });

    expect(res.status).toBe(400);
    expect(mockLogEntryService.create).not.toHaveBeenCalled();
  });

  it('returns 400 when service throws AppError(400) for unknown typeId', async () => {
    (mockLogEntryService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(400, 'Invalid typeId'),
    );

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send(minimalBody);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid typeId' });
  });

  it('returns 403 when vehicle belongs to another account', async () => {
    (mockLogEntryService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send(minimalBody);

    expect(res.status).toBe(403);
  });

  it('returns 404 when vehicle does not exist', async () => {
    (mockLogEntryService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Vehicle not found'),
    );

    const res = await supertest(buildApp())
      .post('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader)
      .send(minimalBody);

    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth header is present', async () => {
    const res = await supertest(buildApp()).post('/vehicles/vehicle-1/log').send(minimalBody);

    expect(res.status).toBe(401);
    expect(mockLogEntryService.create).not.toHaveBeenCalled();
  });
});

/* ── GET /vehicles/:vehicleId/log ──────────────────────────────── */

describe('GET /vehicles/:vehicleId/log', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with list sorted by date desc', async () => {
    (mockLogEntryService.list as ReturnType<typeof vi.fn>).mockResolvedValue([mockSummary]);

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ logEntries: [mockSummary] });
  });

  it('returns 200 with empty array when no entries', async () => {
    (mockLogEntryService.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ logEntries: [] });
  });

  it('passes typeId query param to the service', async () => {
    (mockLogEntryService.list as ReturnType<typeof vi.fn>).mockResolvedValue([mockSummary]);

    await supertest(buildApp())
      .get('/vehicles/vehicle-1/log?typeId=MAINTENANCE')
      .set('Authorization', authHeader);

    expect(mockLogEntryService.list).toHaveBeenCalledWith('vehicle-1', 'account-1', 'MAINTENANCE');
  });

  it('returns 403 when vehicle belongs to another account', async () => {
    (mockLogEntryService.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(403, 'Forbidden'),
    );

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/log')
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await supertest(buildApp()).get('/vehicles/vehicle-1/log');

    expect(res.status).toBe(401);
    expect(mockLogEntryService.list).not.toHaveBeenCalled();
  });
});

/* ── GET /vehicles/:vehicleId/log/:entryId ─────────────────────── */

describe('GET /vehicles/:vehicleId/log/:entryId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the full entry', async () => {
    (mockLogEntryService.getById as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntry);

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ logEntry: { id: 'entry-1' } });
  });

  it('returns 404 when entry does not exist', async () => {
    (mockLogEntryService.getById as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Log entry not found'),
    );

    const res = await supertest(buildApp())
      .get('/vehicles/vehicle-1/log/missing')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await supertest(buildApp()).get('/vehicles/vehicle-1/log/entry-1');

    expect(res.status).toBe(401);
  });
});

/* ── PATCH /vehicles/:vehicleId/log/:entryId ───────────────────── */

describe('PATCH /vehicles/:vehicleId/log/:entryId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with updated entry on partial scalar update', async () => {
    (mockLogEntryService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockEntry,
      title: 'Updated oil change',
    });

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader)
      .send({ title: 'Updated oil change' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ logEntry: { title: 'Updated oil change' } });
  });

  it('returns 200 after items replacement', async () => {
    (mockLogEntryService.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockEntry);

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader)
      .send({
        items: [{ categoryId: 'LABOR', description: 'Labor', quantity: 1, unitCost: 50 }],
      });

    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid input', async () => {
    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader)
      .send({ mileage: -100 });

    expect(res.status).toBe(400);
    expect(mockLogEntryService.update).not.toHaveBeenCalled();
  });

  it('returns 404 when entry not found', async () => {
    (mockLogEntryService.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Log entry not found'),
    );

    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader)
      .send({ title: 'x' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await supertest(buildApp())
      .patch('/vehicles/vehicle-1/log/entry-1')
      .send({ title: 'x' });

    expect(res.status).toBe(401);
  });
});

/* ── DELETE /vehicles/:vehicleId/log/:entryId ──────────────────── */

describe('DELETE /vehicles/:vehicleId/log/:entryId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 204 on successful deletion', async () => {
    (mockLogEntryService.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1/log/entry-1')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
  });

  it('returns 404 when entry does not exist', async () => {
    (mockLogEntryService.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(404, 'Log entry not found'),
    );

    const res = await supertest(buildApp())
      .delete('/vehicles/vehicle-1/log/missing')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await supertest(buildApp()).delete('/vehicles/vehicle-1/log/entry-1');

    expect(res.status).toBe(401);
  });
});
