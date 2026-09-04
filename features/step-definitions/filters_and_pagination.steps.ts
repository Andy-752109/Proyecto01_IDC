// Step definitions for features/filters_and_pagination.feature (SPEC-09)
//
// Both scenarios here insert brand-new synthetic images directly via
// Drizzle instead of mutating real/seeded ones: the API has no way to
// backdate an image's createdAt (the "date range" scenario needs specific
// historical dates), and touching a REAL seeded image's status/createdAt
// would leak into other scenarios that assume those images stay
// untouched — that's exactly the bug this version fixes. All synthetic
// images share the `__t08_test_` filename prefix, cleaned up in
// hooks.ts's After hook.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Given, Then, When } from '@cucumber/cucumber';
import { db } from '../../server/src/db/client';
import { images } from '../../server/src/db/schema';
import { baseUrl } from '../support/hooks';
import { getCategoryIdByName } from '../support/testData';
import { testState } from '../support/testState';
import type { SearchResultBody } from '../support/testState';

type ImageStatus = 'pending' | 'annotated' | 'reviewed';

async function insertTestImage(status: ImageStatus, createdAt: Date): Promise<number> {
  const suffix = randomUUID();
  const [insertResult] = await db.insert(images).values({
    filename: `__t08_test_${suffix}.jpg`,
    storageKey: `test/__t08_test_${suffix}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    width: 100,
    height: 100,
    status,
    createdAt,
  });
  return insertResult.insertId;
}

async function annotateTestImage(imageId: number, categoryId: number): Promise<void> {
  await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 0, y: 0, width: 10, height: 10 }),
  });
}

// --- Combinable filters by class, status and date ---

Given('there are images with different classes, statuses and upload dates', async () => {
  const categoryPersonId = await getCategoryIdByName('person');
  const categoryCarId = await getCategoryIdByName('car');

  const imagePersonPendingAug = await insertTestImage('pending', new Date('2026-08-15T12:00:00Z'));
  await annotateTestImage(imagePersonPendingAug, categoryPersonId);

  const imageCarReviewedJul = await insertTestImage('reviewed', new Date('2026-07-15T12:00:00Z'));
  await annotateTestImage(imageCarReviewedJul, categoryCarId);

  // Decoy: right category ("person") and right status ("pending"), but the
  // WRONG month — proves the date range is actually enforced, not just
  // class+status.
  const imageDecoy = await insertTestImage('pending', new Date('2026-01-01T12:00:00Z'));
  await annotateTestImage(imageDecoy, categoryPersonId);

  testState.filterFixtures = [
    { className: 'person', status: 'pending', imageId: imagePersonPendingAug },
    { className: 'car', status: 'reviewed', imageId: imageCarReviewedJul },
  ];
  testState.filterDecoyImageId = imageDecoy;
});

When(
  'I apply a filter by class {string}, status {string} and date range {string}',
  async (className: string, status: string, range: string) => {
    const [dateFromRaw, dateToRaw] = range.split(' to ').map((part) => part.trim());
    testState.expectedMatchImageId = testState.filterFixtures?.find(
      (fixture) => fixture.className === className && fixture.status === status,
    )?.imageId;

    const params = new URLSearchParams({
      categories: className,
      status,
      dateFrom: dateFromRaw ?? '',
      dateTo: dateToRaw ?? '',
      page: '1',
      pageSize: '20',
    });
    testState.lastResponse = await fetch(`${baseUrl}/api/images/search?${params.toString()}`);
    testState.lastSearchResult = (await testState.lastResponse.json()) as SearchResultBody;
  },
);

Then('only images matching all criteria are shown', () => {
  if (!testState.lastSearchResult || testState.expectedMatchImageId === undefined) {
    throw new Error('Missing search result or expected match — did the When step run first?');
  }
  const resultIds = testState.lastSearchResult.images.map((image) => image.id);
  assert.ok(
    resultIds.includes(testState.expectedMatchImageId),
    'Expected the matching fixture image to be included',
  );
  if (testState.filterDecoyImageId !== undefined) {
    assert.ok(
      !resultIds.includes(testState.filterDecoyImageId),
      'Expected the wrong-month decoy to be excluded',
    );
  }
});

Then('the results are paginated correctly', () => {
  if (!testState.lastSearchResult) {
    throw new Error('No search result to check');
  }
  assert.ok(testState.lastSearchResult.images.length <= testState.lastSearchResult.pageSize);
});

// --- Paginating results ---

Given('there are {int} images matching a filter', async (imageCount: number) => {
  const categoryId = await getCategoryIdByName('bicycle');

  for (let index = 0; index < imageCount; index += 1) {
    const imageId = await insertTestImage('pending', new Date());
    await annotateTestImage(imageId, categoryId);
  }
});

Given('the configured page size is {int}', (pageSize: number) => {
  testState.paginationPageSize = pageSize;
});

When('I request page {int} of results', async (pageNumber: number) => {
  const pageSize = testState.paginationPageSize ?? 20;
  const params = new URLSearchParams({
    categories: 'bicycle',
    page: String(pageNumber),
    pageSize: String(pageSize),
  });
  testState.lastResponse = await fetch(`${baseUrl}/api/images/search?${params.toString()}`);
  testState.lastSearchResult = (await testState.lastResponse.json()) as SearchResultBody;
});

Then('I receive {int} results corresponding to that page', (expectedCount: number) => {
  if (!testState.lastSearchResult) {
    throw new Error('No search result to check');
  }
  assert.equal(testState.lastSearchResult.images.length, expectedCount);
});

Then('the reported total number of results is {int}', (expectedTotal: number) => {
  if (!testState.lastSearchResult) {
    throw new Error('No search result to check');
  }
  assert.equal(testState.lastSearchResult.total, expectedTotal);
});
