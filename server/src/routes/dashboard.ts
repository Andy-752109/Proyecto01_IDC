import { count, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/client';
import { annotations, categories, images } from '../db/schema';

export const dashboardRouter = Router();

// Estados que cuentan como "ya anotada" para el progreso del dashboard:
// 'reviewed' implica que ya pasó por 'annotated' en su momento.
const ANNOTATED_STATUSES = ['annotated', 'reviewed'] as const;

dashboardRouter.get('/summary', async (_req, res, next) => {
  try {
    const [totalImagesRow] = await db.select({ value: count() }).from(images);
    const [annotatedImagesRow] = await db
      .select({ value: count() })
      .from(images)
      .where(inArray(images.status, [...ANNOTATED_STATUSES]));
    const [totalBoundingBoxesRow] = await db.select({ value: count() }).from(annotations);
    const [totalCategoriesRow] = await db.select({ value: count() }).from(categories);

    res.status(200).json({
      totalImages: totalImagesRow?.value ?? 0,
      annotatedImages: annotatedImagesRow?.value ?? 0,
      totalBoundingBoxes: totalBoundingBoxesRow?.value ?? 0,
      totalCategories: totalCategoriesRow?.value ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/objects-by-category', async (_req, res, next) => {
  try {
    // LEFT JOIN a propósito: una categoría sin anotaciones todavía debe
    // aparecer en la gráfica con 0, no desaparecer del resultado.
    const rows = await db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        color: categories.color,
        objectCount: count(annotations.id),
      })
      .from(categories)
      .leftJoin(annotations, eq(annotations.categoryId, categories.id))
      .groupBy(categories.id, categories.name, categories.color)
      .orderBy(categories.name);

    res.status(200).json({ objectsByCategory: rows });
  } catch (error) {
    next(error);
  }
});
