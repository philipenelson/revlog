import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import type { AccountService } from '../services/account.service';
import { authenticate } from '../middleware/auth';

export function createOnboardingRouter(accountService: AccountService): ExpressRouter {
  const router = Router();

  router.post('/skip', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await accountService.skipOnboarding(req.auth!.accountId);
      res.status(200).json({ status: 'ACTIVE' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
