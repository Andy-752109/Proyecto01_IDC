import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/client';
import { annotations, categories, images } from '../db/schema';
import { createAnnotationSchema, updateAnnotationSchema } from '../schemas/annotation';

export const annotationsRouter = Router();

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/annotations — create a box with a category (SPEC-02 create, SPEC-03 validation).
annotationsRouter.post('/', async (req, res, next) => {
  try {
    const parseResult = createAnnotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid annotation payload', details: parseResult.error.flatten() });
      return;
    }
    const { imageId, categoryId, x, y, width, height } = parseResult.data;

    const [image] = await db.select().from(images).where(eq(images.id, imageId)).limit(1);
    if (!image) {
      res.status(400).json({ error: `Image ${imageId} does not exist` });
      return;
    }

    // SPEC-03: reject the box if the category doesn't exist — this is the
    // "a valid class must be assigned" rule, enforced against the real table
    // (not just "is it a number", which the Zod schema already checked).
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!category) {
      res
        .status(400)
        .json({ error: `Category ${categoryId} does not exist. A valid class must be assigned.` });
      return;
    }

    // NOTE: the exact shape of the insert result depends on the installed
    // drizzle-orm version's mysql2 driver typings. This follows the current
    // documented pattern (result[0].insertId); if `npm run typecheck` flags
    // this line, adjust the destructuring to match — TypeScript strict mode
    // will catch a mismatch immediately, it won't fail silently.
    const insertResult = await db
      .insert(annotations)
      .values({ imageId, categoryId, x, y, width, height });
    const insertId = insertResult[0].insertId;

    const [created] = await db
      .select()
      .from(annotations)
      .where(eq(annotations.id, insertId))
      .limit(1);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/annotations/:id — move (x, y) or resize (width, height).
annotationsRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid annotation id' });
      return;
    }

    const parseResult = updateAnnotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid update payload', details: parseResult.error.flatten() });
      return;
    }

    const [existing] = await db.select().from(annotations).where(eq(annotations.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: `Annotation ${id} not found` });
      return;
    }

    await db.update(annotations).set(parseResult.data).where(eq(annotations.id, id));

    const [updated] = await db.select().from(annotations).where(eq(annotations.id, id)).limit(1);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/annotations/:id
annotationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid annotation id' });
      return;
    }

    const [existing] = await db.select().from(annotations).where(eq(annotations.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: `Annotation ${id} not found` });
      return;
    }

    await db.delete(annotations).where(eq(annotations.id, id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
