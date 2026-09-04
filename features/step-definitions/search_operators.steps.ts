// Step definitions for features/search_operators.feature (SPEC-08)
//
// Only AND is in scope (PM decision, 2026-09-02) — no OR/NOT steps.

import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { baseUrl } from '../support/hooks';
import { getCategoryIdByName, getSeededImageIds } from '../support/testData';
import { testState } from '../support/testState';
import type { SearchResultBody } from '../support/testState';

async function createAnnotation(
  imageId: number,
  categoryId: number,
  x: number,
  y: number,
): Promise<void> {
  await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x, y, width: 10, height: 10 }),
  });
}

Given(
  'there are annotated images with categories {string} and {string}',
  async (categoryAName: string, categoryBName: string) => {
    const categoryAId = await getCategoryIdByName(categoryAName);
    const categoryBId = await getCategoryIdByName(categoryBName);
    const [imageOnlyA, imageOnlyB, imageBoth] = await getSeededImageIds(3);

    // Two decoys (each with only ONE of the two categories) plus one target
    // image with BOTH — this is what actually proves AND semantics, not just
    // "any category matches".
    await createAnnotation(imageOnlyA, categoryAId, 0, 0);
    await createAnnotation(imageOnlyB, categoryBId, 0, 0);
    await createAnnotation(imageBoth, categoryAId, 0, 0);
    await createAnnotation(imageBoth, categoryBId, 20, 20);

    testState.searchTargetImageId = imageBoth;
    testState.searchDecoyImageIds = [imageOnlyA, imageOnlyB];
  },
);

Given(
  'no image has both categories {string} and {string} at the same time',
  (_categoryA: string, _categoryB: string) => {
    // No setup needed: "boat" isn't part of the seeded category set at all,
    // so by construction no image can have an annotation in it. The search
    // endpoint handles an unknown category name gracefully (it just never
    // matches) — that's exactly the behavior this scenario checks.
    // _categoryA/_categoryB unused: Cucumber requires the callback arity to
    // match the step's capture-group count (2).
  },
);

When('I search {string}', async (query: string) => {
  const categoryNames = query
    .split(/\s+AND\s+/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const params = new URLSearchParams({ categories: categoryNames.join(',') });
  testState.lastResponse = await fetch(`${baseUrl}/api/images/search?${params.toString()}`);
  testState.lastSearchResult = (await testState.lastResponse.json()) as SearchResultBody;
});

Then('I get only the images that contain both categories', () => {
  if (!testState.lastSearchResult || testState.searchTargetImageId === undefined) {
    throw new Error('Missing search result or target image');
  }
  const resultIds = testState.lastSearchResult.images.map((image) => image.id);
  assert.ok(
    resultIds.includes(testState.searchTargetImageId),
    'Expected the image with both categories to be included',
  );
  for (const decoyId of testState.searchDecoyImageIds ?? []) {
    assert.ok(
      !resultIds.includes(decoyId),
      `Expected decoy image ${decoyId} (only one category) to be excluded`,
    );
  }
});

Then('I get an empty list of results', () => {
  if (!testState.lastSearchResult) {
    throw new Error('No search result to check');
  }
  assert.equal(testState.lastSearchResult.images.length, 0);
  assert.equal(testState.lastSearchResult.total, 0);
});
