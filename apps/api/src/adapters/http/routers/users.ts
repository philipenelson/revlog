import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import type { UserService } from '../../../application/services/user.service';
import { authenticate } from '../middleware/auth';

export function createUsersRouter(userService: UserService): ExpressRouter {
  const router = Router();

  // GET /users/me — the current user's profile, resolved from the access
  // token (req.auth.sub). No :id param, so it cannot read another user; a
  // self-or-admin GET /users/:id is reserved for V2 (ADR 0033).
  router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await userService.getCurrentUser(req.auth!.sub);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
