import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { newsletterSubscribeSchema } from '@maintenance-log/domain';
import type { NewsletterService } from '../services/newsletter.service';

const SUBSCRIBED_MESSAGE = "You're subscribed — thanks for following along.";

export function createNewsletterRouter(newsletterService: NewsletterService): ExpressRouter {
  const router = Router();

  router.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = newsletterSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    try {
      const { created } = await newsletterService.subscribe(parsed.data);
      res.status(created ? 201 : 200).json({ message: SUBSCRIBED_MESSAGE });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
