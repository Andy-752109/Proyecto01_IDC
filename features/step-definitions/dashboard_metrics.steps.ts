import assert from 'node:assert/strict';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { eq } from 'drizzle-orm';
import { db } from '../../server/src/db/client';
import { annotations, images } from '../../server/src/db/schema';
import { baseUrl } from '../support/hooks';
import { getCategoryIdByName } from '../support/testData';

// SPEC-10 (features/dashboard_metrics.feature): las métricas del dashboard
// se calculan desde la BD; ninguna es un valor fijo.

type Summary = {
  totalImages: number;
  annotatedImages: number;
  totalBoundingBoxes: number;
  totalCategories: number;
};

type ObjectsByCategoryRow = {
  categoryId: number;
  categoryName: string;
  color: string;
  objectCount: number;
};

let baselineSummary: Summary | undefined;
let lastSummary: Summary | undefined;
let lastObjectsByCategory: ObjectsByCategoryRow[] | undefined;

const createdImageIds: number[] = [];

async function createTestImage(status: 'pending' | 'annotated' | 'reviewed'): Promise<number> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [result] = await db.insert(images).values({
    filename: `dashboard-bdd-${suffix}.jpg`,
    storageKey: `test/dashboard-bdd-${suffix}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    width: 10,
    height: 10,
    status,
  });
  createdImageIds.push(result.insertId);
  return result.insertId;
}

async function createTestAnnotation(imageId: number, categoryId: number): Promise<void> {
  await db.insert(annotations).values({ imageId, categoryId, x: 0, y: 0, width: 10, height: 10 });
}

async function fetchSummary(): Promise<Summary> {
  const response = await fetch(`${baseUrl}/api/dashboard/summary`);
  return (await response.json()) as Summary;
}

async function fetchObjectsByCategory(): Promise<ObjectsByCategoryRow[]> {
  const response = await fetch(`${baseUrl}/api/dashboard/objects-by-category`);
  const body = (await response.json()) as { objectsByCategory: ObjectsByCategoryRow[] };
  return body.objectsByCategory;
}

After(async () => {
  for (const id of createdImageIds) {
    await db.delete(images).where(eq(images.id, id));
  }
  createdImageIds.length = 0;
  baselineSummary = undefined;
  lastSummary = undefined;
  lastObjectsByCategory = undefined;
});

Given(
  'a dataset with {int} annotations for category {string} and {int} annotations for category {string}',
  async (
    firstCount: number,
    firstCategory: string,
    secondCount: number,
    secondCategory: string,
  ) => {
    const firstCategoryId = await getCategoryIdByName(firstCategory);
    const secondCategoryId = await getCategoryIdByName(secondCategory);
    const imageId = await createTestImage('annotated');

    for (let i = 0; i < firstCount; i += 1) {
      await createTestAnnotation(imageId, firstCategoryId);
    }
    for (let i = 0; i < secondCount; i += 1) {
      await createTestAnnotation(imageId, secondCategoryId);
    }
  },
);

Given(
  '{int} new images are added, {int} of which are already annotated',
  async (total: number, annotated: number) => {
    baselineSummary = await fetchSummary();
    for (let i = 0; i < annotated; i += 1) {
      await createTestImage('annotated');
    }
    for (let i = 0; i < total - annotated; i += 1) {
      await createTestImage('pending');
    }
  },
);

Given('the dashboard is loaded with the current totals', async () => {
  baselineSummary = await fetchSummary();
});

When('I open the dashboard', async () => {
  lastSummary = await fetchSummary();
  lastObjectsByCategory = await fetchObjectsByCategory();
});

When('a new annotation is added and I reload the dashboard', async () => {
  const imageId = await createTestImage('annotated');
  const categoryId = await getCategoryIdByName('car');
  await createTestAnnotation(imageId, categoryId);
  lastSummary = await fetchSummary();
  lastObjectsByCategory = await fetchObjectsByCategory();
});

Then(
  'the objects-per-class count for {string} is {int}',
  (categoryName: string, expectedCount: number) => {
    const row = lastObjectsByCategory?.find((entry) => entry.categoryName === categoryName);
    assert.ok(row, `No se encontró la categoría "${categoryName}" en la respuesta`);
    assert.equal(row.objectCount, expectedCount);
  },
);

Then('the total images count increased by {int}', (expectedDelta: number) => {
  assert.ok(baselineSummary, 'No hay baseline capturado');
  assert.ok(lastSummary, 'No se abrió el dashboard todavía');
  assert.equal(lastSummary.totalImages - baselineSummary.totalImages, expectedDelta);
});

Then('the annotated images count increased by {int}', (expectedDelta: number) => {
  assert.ok(baselineSummary, 'No hay baseline capturado');
  assert.ok(lastSummary, 'No se abrió el dashboard todavía');
  assert.equal(lastSummary.annotatedImages - baselineSummary.annotatedImages, expectedDelta);
});

Then('the total bounding boxes count increased by {int}', (expectedDelta: number) => {
  assert.ok(baselineSummary, 'No hay baseline capturado');
  assert.ok(lastSummary, 'No se recargó el dashboard todavía');
  assert.equal(lastSummary.totalBoundingBoxes - baselineSummary.totalBoundingBoxes, expectedDelta);
});
