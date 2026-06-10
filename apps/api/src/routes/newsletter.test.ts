import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createNewsletterRouter } from './newsletter';
import { errorMiddleware } from '../middleware/error';
import type { NewsletterService } from '../services/newsletter.service';

const mockNewsletterService: Pick<NewsletterService, 'subscribe'> = {
  subscribe: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/newsletter', createNewsletterRouter(mockNewsletterService as NewsletterService));
  app.use(errorMiddleware);
  return app;
}

const SUBSCRIBED_MESSAGE = "You're subscribed — thanks for following along.";

describe('POST /newsletter/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 when a new subscriber is created', async () => {
    (mockNewsletterService.subscribe as ReturnType<typeof vi.fn>).mockResolvedValue({ created: true });

    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({ email: 'test@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: SUBSCRIBED_MESSAGE });
  });

  it('returns 200 with the same message when the email is already subscribed', async () => {
    (mockNewsletterService.subscribe as ReturnType<typeof vi.fn>).mockResolvedValue({ created: false });

    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: SUBSCRIBED_MESSAGE });
  });

  it('calls newsletterService.subscribe with the trimmed, lowercased email', async () => {
    (mockNewsletterService.subscribe as ReturnType<typeof vi.fn>).mockResolvedValue({ created: true });

    await supertest(buildApp()).post('/newsletter/subscribe').send({ email: '  Test@Example.COM  ' });

    expect(mockNewsletterService.subscribe).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('returns 400 and does not call the service when the email is missing', async () => {
    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(mockNewsletterService.subscribe).not.toHaveBeenCalled();
  });

  it('returns 400 and does not call the service when the email is malformed', async () => {
    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(mockNewsletterService.subscribe).not.toHaveBeenCalled();
  });

  it('returns 400 and does not call the service when the email exceeds 254 characters', async () => {
    const longEmail = `${'a'.repeat(250)}@example.com`;

    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({ email: longEmail });

    expect(res.status).toBe(400);
    expect(mockNewsletterService.subscribe).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockNewsletterService.subscribe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).post('/newsletter/subscribe').send({ email: 'test@example.com' });

    expect(res.status).toBe(500);
  });
});
