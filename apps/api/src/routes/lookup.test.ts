import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createLookupRouter } from './lookup';

function buildApp() {
  const app = express();
  app.use(createLookupRouter());
  return app;
}

describe('GET /log-entry-types', () => {
  it('returns 200 with the 7 type IDs in seed order', async () => {
    const res = await supertest(buildApp()).get('/log-entry-types');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      logEntryTypes: [
        'MAINTENANCE',
        'REPAIR',
        'INSPECTION',
        'MODIFICATION',
        'INCIDENT',
        'EVENT',
        'OTHER',
      ],
    });
  });

  it('requires no authentication', async () => {
    const res = await supertest(buildApp()).get('/log-entry-types');
    expect(res.status).toBe(200);
  });
});

describe('GET /item-categories', () => {
  it('returns 200 with the 4 category IDs in seed order', async () => {
    const res = await supertest(buildApp()).get('/item-categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      itemCategories: ['PART', 'LABOR', 'FEE', 'OTHER'],
    });
  });

  it('requires no authentication', async () => {
    const res = await supertest(buildApp()).get('/item-categories');
    expect(res.status).toBe(200);
  });
});
