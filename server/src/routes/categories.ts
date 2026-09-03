import { Router } from 'express';
import { db } from '../db/client';
import { categories } from '../db/schema';

export const categoriesRouter = Router();

// GET /api/categories — list only. The 4 categories come from T-03's
// seeder; T-05 does not create/update/delete categories (not in any SPEC).
categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const allCategories = await db.select().from(categories);
    res.json(allCategories);
  } catch (error) {
    next(error);
  }
});
