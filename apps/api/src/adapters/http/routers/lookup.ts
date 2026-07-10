import { Router } from 'express';
import { LOG_ENTRY_TYPE, ITEM_CATEGORY } from '@maintenance-log/domain';

const LOG_ENTRY_TYPES = Object.values(LOG_ENTRY_TYPE);
const ITEM_CATEGORIES = Object.values(ITEM_CATEGORY);

export function createLookupRouter(): Router {
  const router = Router();

  router.get('/log-entry-types', (_req, res) => {
    res.json({ logEntryTypes: LOG_ENTRY_TYPES });
  });

  router.get('/item-categories', (_req, res) => {
    res.json({ itemCategories: ITEM_CATEGORIES });
  });

  return router;
}
