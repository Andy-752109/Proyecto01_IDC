import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app';
import { db, pool } from '../db/client';
import { annotations, categories, images } from '../db/schema';
import { ensureBucketExists } from '../lib/minio';

// SPEC-10 (features/dashboard_metrics.feature): las métricas del dashboard
// se calculan desde la BD; ninguna es un valor fijo.

const app = createApiApp();

let testImageIds: number[] = [];
let testAnnotationIds: number[] = [];

async function insertTestImage(status: 'pending' | 'annotated' | 'reviewed' = 'pending') {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [result] = await db.insert(images).values({
    filename: `dashboard-test-${suffix}.jpg`,
    storageKey: `test/dashboard-${suffix}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    width: 10,
    height: 10,
    status,
  });
  testImageIds.push(result.insertId);
  return result.insertId;
}

async function getCategoryId(name: string): Promise<number> {
  const [row] = await db.select().from(categories).where(eq(categories.name, name));
  if (!row) {
    throw new Error(`Categoría de seed "${name}" no encontrada. ¿Corriste npm run db:seed?`);
  }
  return row.id;
}

async function insertTestAnnotation(imageId: number, categoryId: number) {
  const [result] = await db.insert(annotations).values({
    imageId,
    categoryId,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  testAnnotationIds.push(result.insertId);
  return result.insertId;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  await ensureBucketExists();
});

afterEach(async () => {
  for (const id of testAnnotationIds) {
    await db.delete(annotations).where(eq(annotations.id, id));
  }
  testAnnotationIds = [];
  for (const id of testImageIds) {
    await db.delete(images).where(eq(images.id, id));
  }
  testImageIds = [];
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/dashboard/summary', () => {
  it('cuenta imágenes, imágenes anotadas y bounding boxes desde SQL (COUNT), no en JS', async () => {
    const before = await request(app).get('/api/dashboard/summary');
    expect(before.status).toBe(200);

    const pendingImageId = await insertTestImage('pending');
    const annotatedImageId = await insertTestImage('annotated');
    const carCategoryId = await getCategoryId('car');
    await insertTestAnnotation(annotatedImageId, carCategoryId);
    await insertTestAnnotation(annotatedImageId, carCategoryId);

    const after = await request(app).get('/api/dashboard/summary');

    expect(after.status).toBe(200);
    expect(after.body.totalImages).toBe(before.body.totalImages + 2);
    expect(after.body.annotatedImages).toBe(before.body.annotatedImages + 1);
    expect(after.body.totalBoundingBoxes).toBe(before.body.totalBoundingBoxes + 2);
    expect(after.body.totalCategories).toBe(before.body.totalCategories);
    expect(pendingImageId).toBeGreaterThan(0);
  });

  it('cuenta las imágenes en estado "reviewed" también como anotadas para el progreso', async () => {
    const before = await request(app).get('/api/dashboard/summary');
    await insertTestImage('reviewed');
    const after = await request(app).get('/api/dashboard/summary');

    expect(after.body.annotatedImages).toBe(before.body.annotatedImages + 1);
  });
});

describe('GET /api/dashboard/objects-by-category', () => {
  it('agrupa el conteo de anotaciones por categoría vía GROUP BY', async () => {
    const carCategoryId = await getCategoryId('car');
    const personCategoryId = await getCategoryId('person');

    const before = await request(app).get('/api/dashboard/objects-by-category');
    const carBefore = before.body.objectsByCategory.find(
      (row: { categoryId: number }) => row.categoryId === carCategoryId,
    ).objectCount;
    const personBefore = before.body.objectsByCategory.find(
      (row: { categoryId: number }) => row.categoryId === personCategoryId,
    ).objectCount;

    const imageId = await insertTestImage('annotated');
    await insertTestAnnotation(imageId, carCategoryId);
    await insertTestAnnotation(imageId, carCategoryId);
    await insertTestAnnotation(imageId, carCategoryId);
    await insertTestAnnotation(imageId, personCategoryId);
    await insertTestAnnotation(imageId, personCategoryId);

    const after = await request(app).get('/api/dashboard/objects-by-category');
    const carAfter = after.body.objectsByCategory.find(
      (row: { categoryId: number }) => row.categoryId === carCategoryId,
    ).objectCount;
    const personAfter = after.body.objectsByCategory.find(
      (row: { categoryId: number }) => row.categoryId === personCategoryId,
    ).objectCount;

    expect(carAfter).toBe(carBefore + 3);
    expect(personAfter).toBe(personBefore + 2);
  });

  it('incluye categorías sin ninguna anotación con conteo 0, no las omite', async () => {
    const response = await request(app).get('/api/dashboard/objects-by-category');
    const dogCategoryId = await getCategoryId('dog');
    const dogRow = response.body.objectsByCategory.find(
      (row: { categoryId: number }) => row.categoryId === dogCategoryId,
    );
    expect(dogRow).toBeDefined();
    expect(dogRow.objectCount).toBeGreaterThanOrEqual(0);
  });
});

describe('anti-hardcode', () => {
  it('las métricas cambian cuando cambian los datos subyacentes (no son valores fijos)', async () => {
    const before = await request(app).get('/api/dashboard/summary');

    const imageId = await insertTestImage('annotated');
    const carCategoryId = await getCategoryId('car');
    await insertTestAnnotation(imageId, carCategoryId);

    const after = await request(app).get('/api/dashboard/summary');

    expect(after.body.totalBoundingBoxes).not.toBe(before.body.totalBoundingBoxes);
    expect(after.body.totalBoundingBoxes).toBe(before.body.totalBoundingBoxes + 1);
  });
});
