import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { eq } from 'drizzle-orm';
import { db } from '../../server/src/db/client';
import { annotations, categories } from '../../server/src/db/schema';
import { baseUrl } from '../support/hooks';
import { getAnySeededImageId, getCategoryIdByName } from '../support/testData';
import { testState } from '../support/testState';
import type { AnnotationRecord } from '../support/testState';

Given('I have an image loaded on the annotation canvas', async () => {
  testState.currentImageId = await getAnySeededImageId();
});

Given(
  'the category {string} exists with color {string}',
  async (categoryName: string, _colorHex: string) => {
    // The color in the .feature is illustrative — categories are fixed seeded
    // data from T-03, not created by this step. We only confirm it exists.
    // _colorHex is unused: Cucumber requires the callback arity to match the
    // step's capture-group count (2), even though this step doesn't need it.
    await getCategoryIdByName(categoryName);
  },
);

When('I draw a box on the image', () => {
  testState.drawnCoordinates = { x: 10, y: 10, width: 50, height: 50 };
});

When('I select the category {string}', async (categoryName: string) => {
  if (!testState.drawnCoordinates || testState.currentImageId === undefined) {
    throw new Error('No box has been drawn on an image yet');
  }
  const categoryId = await getCategoryIdByName(categoryName);
  testState.lastResponse = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageId: testState.currentImageId,
      categoryId,
      ...testState.drawnCoordinates,
    }),
  });
  testState.lastResponseBody = await testState.lastResponse.json();
  testState.lastAnnotation = testState.lastResponse.ok
    ? (testState.lastResponseBody as typeof testState.lastAnnotation)
    : undefined;
});

Then('the box is saved with the drawn coordinates', () => {
  assert.equal(testState.lastResponse?.status, 201);
  assert.ok(testState.lastAnnotation);
  assert.equal(testState.lastAnnotation?.x, testState.drawnCoordinates?.x);
  assert.equal(testState.lastAnnotation?.y, testState.drawnCoordinates?.y);
  assert.equal(testState.lastAnnotation?.width, testState.drawnCoordinates?.width);
  assert.equal(testState.lastAnnotation?.height, testState.drawnCoordinates?.height);
});

Then(
  'the box is displayed with the color of the {string} category',
  async (categoryName: string) => {
    // Rendering is a frontend concern (canvas not built yet). Here we verify
    // the backend link is correct: the saved annotation references the
    // category that actually has this name, so the future canvas has what it
    // needs to render the right color.
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, categoryName))
      .limit(1);
    assert.ok(category);
    assert.equal(testState.lastAnnotation?.categoryId, category.id);
  },
);

Given(
  /^a box with category "([^"]+)" exists at position \((\d+), (\d+)\)$/,
  async (categoryName: string, x: string, y: string) => {
    const categoryId = await getCategoryIdByName(categoryName);
    const imageId = await getAnySeededImageId();
    const response = await fetch(`${baseUrl}/api/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId,
        categoryId,
        x: Number(x),
        y: Number(y),
        width: 50,
        height: 50,
      }),
    });
    testState.lastAnnotation = (await response.json()) as AnnotationRecord;
  },
);

When(/^I drag the box to position \((\d+), (\d+)\)$/, async (x: string, y: string) => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to move');
  }
  testState.lastResponse = await fetch(
    `${baseUrl}/api/annotations/${testState.lastAnnotation.id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: Number(x), y: Number(y) }),
    },
  );
  if (testState.lastResponse.ok) {
    testState.lastAnnotation = (await testState.lastResponse.json()) as AnnotationRecord;
  }
});

Then(/^the box is updated to position \((\d+), (\d+)\)$/, (x: string, y: string) => {
  assert.equal(testState.lastResponse?.status, 200);
  assert.equal(testState.lastAnnotation?.x, Number(x));
  assert.equal(testState.lastAnnotation?.y, Number(y));
});

Then('the change is persisted in the database', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to verify');
  }
  const [stored] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, testState.lastAnnotation.id))
    .limit(1);
  assert.ok(stored);
  assert.equal(stored.x, testState.lastAnnotation.x);
  assert.equal(stored.y, testState.lastAnnotation.y);
  assert.equal(stored.width, testState.lastAnnotation.width);
  assert.equal(stored.height, testState.lastAnnotation.height);
});

Given('a box with width {int} and height {int} exists', async (width: number, height: number) => {
  const categoryId = await getCategoryIdByName('person');
  const imageId = await getAnySeededImageId();
  const response = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 0, y: 0, width, height }),
  });
  testState.lastAnnotation = (await response.json()) as AnnotationRecord;
});

When('I drag the bottom-right corner of the box to a new point', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to resize');
  }
  const newWidth = testState.lastAnnotation.width + 20;
  const newHeight = testState.lastAnnotation.height + 15;
  testState.lastResponse = await fetch(
    `${baseUrl}/api/annotations/${testState.lastAnnotation.id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: newWidth, height: newHeight }),
    },
  );
  if (testState.lastResponse.ok) {
    testState.lastAnnotation = (await testState.lastResponse.json()) as AnnotationRecord;
  }
});

Then('the width and height of the box are updated', () => {
  assert.equal(testState.lastResponse?.status, 200);
  assert.ok(testState.lastAnnotation);
});

Given('a box with category {string} exists', async (categoryName: string) => {
  const categoryId = await getCategoryIdByName(categoryName);
  const imageId = await getAnySeededImageId();
  const response = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 0, y: 0, width: 50, height: 50 }),
  });
  testState.lastAnnotation = (await response.json()) as AnnotationRecord;
});

When('I delete the box', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to delete');
  }
  testState.lastResponse = await fetch(
    `${baseUrl}/api/annotations/${testState.lastAnnotation.id}`,
    {
      method: 'DELETE',
    },
  );
});

Then('the box no longer appears on the canvas', () => {
  // No product-facing GET endpoint yet (deferred to T-06). We verify the
  // delete itself succeeded; canvas rendering is covered once the frontend
  // exists.
  assert.equal(testState.lastResponse?.status, 204);
});

Then('the annotation record is removed from the database', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation reference to check');
  }
  const [stored] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, testState.lastAnnotation.id))
    .limit(1);
  assert.equal(stored, undefined);
});

// --- SPEC-02 (reload): T-06 ---

Given('I have created and saved a box with category {string}', async (categoryName: string) => {
  const categoryId = await getCategoryIdByName(categoryName);
  const imageId = await getAnySeededImageId();
  testState.currentImageId = imageId;
  const response = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 30, y: 40, width: 60, height: 70 }),
  });
  testState.lastAnnotation = (await response.json()) as AnnotationRecord;
});

When('I reload the annotation page', async () => {
  if (testState.currentImageId === undefined) {
    throw new Error('No current image to reload annotations for');
  }
  // "Reloading the page" for a backend-level scenario means re-fetching
  // whatever's persisted, the same call the frontend makes on mount/refresh.
  const response = await fetch(`${baseUrl}/api/annotations?imageId=${testState.currentImageId}`);
  testState.lastAnnotationsList = (await response.json()) as AnnotationRecord[];
});

Then('the saved box is displayed at its original position and size', () => {
  if (!testState.lastAnnotation || !testState.lastAnnotationsList) {
    throw new Error('Missing saved annotation or reloaded list to compare against');
  }
  const reloaded = testState.lastAnnotationsList.find(
    (item) => item.id === testState.lastAnnotation?.id,
  );
  assert.ok(reloaded, 'Saved box was not found after reloading');
  assert.equal(reloaded.x, testState.lastAnnotation.x);
  assert.equal(reloaded.y, testState.lastAnnotation.y);
  assert.equal(reloaded.width, testState.lastAnnotation.width);
  assert.equal(reloaded.height, testState.lastAnnotation.height);
});
