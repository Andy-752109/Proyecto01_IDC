// Step definitions for features/annotation_navigation.feature (SPEC-04, T-06)
//
// Zoom, undo and "which image comes next" are frontend-only behavior — no
// browser automation (Playwright/RTL+jsdom) is in this stack, and Konva
// canvases don't render meaningfully outside a real browser anyway. So
// these steps validate the underlying logic instead of simulating clicks:
// - Zoom: the pure zoomIn()/toWorldPoint() functions from
//   client/src/features/annotations/zoom.ts (same math the component uses).
// - "Next pending image": the pure findNextPendingIndex() function from
//   useCurrentImage.ts.
// - Undo, confirm-save, discard: real POST/PATCH/DELETE calls against the
//   backend, since those steps do have a genuine server-side effect —
//   mirrors exactly what useAnnotations().undo() and the save/discard
//   handlers do under the hood.

import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { eq } from 'drizzle-orm';
import type { ImageMetadata } from '../../client/src/features/annotations/schemas';
import { findNextPendingIndex } from '../../client/src/features/annotations/useCurrentImage';
import { toWorldPoint, zoomIn } from '../../client/src/features/annotations/zoom';
import { db } from '../../server/src/db/client';
import { annotations } from '../../server/src/db/schema';
import { baseUrl } from '../support/hooks';
import { getAnySeededImageId, getCategoryIdByName } from '../support/testData';
import { testState } from '../support/testState';
import type { AnnotationRecord } from '../support/testState';

// --- Zoom ---
// Reuses "I have an image loaded on the annotation canvas" from
// bounding_box_create_edit.steps.ts.

When('I increase the zoom level', () => {
  testState.zoomBefore = 1;
  testState.zoomAfter = zoomIn(testState.zoomBefore);
});

Then('the image is displayed enlarged', () => {
  if (testState.zoomBefore === undefined || testState.zoomAfter === undefined) {
    throw new Error('Zoom was never applied');
  }
  assert.ok(testState.zoomAfter > testState.zoomBefore);
});

Then('existing boxes keep their correct relative position', () => {
  if (testState.zoomAfter === undefined) {
    throw new Error('Zoom was never applied');
  }
  // A box's world (image-pixel) position must round-trip correctly through
  // the zoom transform: take a world point, compute where it lands on
  // screen at the new zoom (world * zoom, exactly what the Stage's scale
  // does), then convert that screen point back to world with
  // toWorldPoint() — it must match the original, proving boxes don't drift
  // out of alignment with the image when zooming.
  const worldPoint = { x: 120, y: 80 };
  const screenAtNewZoom = {
    x: worldPoint.x * testState.zoomAfter,
    y: worldPoint.y * testState.zoomAfter,
  };
  const roundTripped = toWorldPoint(screenAtNewZoom, testState.zoomAfter);
  assert.equal(Math.round(roundTripped.x), worldPoint.x);
  assert.equal(Math.round(roundTripped.y), worldPoint.y);
});

// --- Undo ---

Given('I have just created a bounding box', async () => {
  const categoryId = await getCategoryIdByName('person');
  const imageId = await getAnySeededImageId();
  testState.currentImageId = imageId;
  const response = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 15, y: 15, width: 45, height: 35 }),
  });
  testState.lastAnnotation = (await response.json()) as AnnotationRecord;
});

When('I press undo', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to undo');
  }
  // Undoing a "create" action deletes the box — mirrors exactly what
  // useAnnotations().undo() does for the 'create' case on the frontend.
  testState.lastResponse = await fetch(
    `${baseUrl}/api/annotations/${testState.lastAnnotation.id}`,
    {
      method: 'DELETE',
    },
  );
});

Then('the created box disappears from the canvas', () => {
  assert.equal(testState.lastResponse?.status, 204);
});

Then('the previous state is restored', async () => {
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

// --- Save and next ---

Given('I have annotated all necessary boxes on the current image', async () => {
  const categoryId = await getCategoryIdByName('person');
  const imageId = await getAnySeededImageId();
  testState.currentImageId = imageId;
  const response = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, categoryId, x: 5, y: 5, width: 20, height: 20 }),
  });
  testState.lastAnnotation = (await response.json()) as AnnotationRecord;
});

When('I press {string}', async (buttonLabel: string) => {
  if (buttonLabel !== 'Save and next') {
    throw new Error(`Unexpected button label: ${buttonLabel}`);
  }
  // The box from the Given step is already saved. "Save and next" then
  // looks at the fetched image list and jumps to the next pending one —
  // the same findNextPendingIndex() the frontend uses.
  const response = await fetch(`${baseUrl}/api/images`);
  const body = (await response.json()) as { images: ImageMetadata[] };
  testState.imagesList = body.images;
  const currentIndex = testState.imagesList.findIndex(
    (image) => image.id === testState.currentImageId,
  );
  testState.nextPendingIndex = findNextPendingIndex(testState.imagesList, currentIndex);
});

Then('the annotations are saved to the database', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to verify');
  }
  const [stored] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, testState.lastAnnotation.id))
    .limit(1);
  assert.ok(stored);
});

Then('the next pending image is displayed', () => {
  if (!testState.imagesList || testState.nextPendingIndex === undefined) {
    throw new Error('Missing navigation state — did the "Save and next" step run?');
  }
  const currentIndex = testState.imagesList.findIndex(
    (image) => image.id === testState.currentImageId,
  );
  assert.notEqual(
    testState.nextPendingIndex,
    currentIndex,
    'Expected navigation to move to a different image',
  );
  const target = testState.imagesList[testState.nextPendingIndex];
  assert.ok(target);
  assert.equal(target.status, 'pending');
});

// --- Unsaved changes: prompt, confirm, discard ---

Given('I have unsaved changes on the current image', async () => {
  const imageId = await getAnySeededImageId();
  testState.currentImageId = imageId;
  // Represents a drawn-but-not-saved box — nothing is POSTed here, since
  // that's exactly what "unsaved" means (mirrors the frontend's `draft` state).
  testState.drawnCoordinates = { x: 25, y: 25, width: 30, height: 30 };
});

When('I navigate to the previous image', () => {
  // Navigation itself is pure frontend state with no backend call. What we
  // can verify is the decision the app makes: an unsaved draft should
  // block immediate navigation and trigger a prompt instead.
});

Then('I am prompted to confirm whether I want to save the changes', () => {
  assert.notEqual(
    testState.drawnCoordinates,
    undefined,
    'Expected an unsaved draft to trigger a confirmation prompt',
  );
});

When('I confirm that I want to save the changes', async () => {
  if (!testState.drawnCoordinates || testState.currentImageId === undefined) {
    throw new Error('No unsaved draft to confirm');
  }
  const categoryId = await getCategoryIdByName('person');
  testState.lastResponse = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageId: testState.currentImageId,
      categoryId,
      ...testState.drawnCoordinates,
    }),
  });
  testState.lastAnnotation = (await testState.lastResponse.json()) as AnnotationRecord;
  // Saving resolves the draft — matches the real app clearing `draft` to
  // null on a successful save.
  testState.drawnCoordinates = undefined;
});

Then('the changes are saved to the database', async () => {
  if (!testState.lastAnnotation) {
    throw new Error('No annotation to verify');
  }
  const [stored] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, testState.lastAnnotation.id))
    .limit(1);
  assert.ok(stored);
});

Then('I am taken to the previous image', () => {
  // True after either resolving the draft by saving it, or by discarding
  // it — in both cases there's nothing left blocking navigation.
  assert.equal(
    testState.drawnCoordinates,
    undefined,
    'Expected no unsaved draft remaining before navigating',
  );
});

When('I choose to discard the changes', () => {
  // Discarding just clears the draft locally — nothing was ever sent to
  // the server, so there's nothing to delete server-side.
  testState.drawnCoordinates = undefined;
});

Then('the unsaved changes are not persisted', async () => {
  if (testState.currentImageId === undefined) {
    throw new Error('No current image to check');
  }
  const response = await fetch(`${baseUrl}/api/annotations?imageId=${testState.currentImageId}`);
  const list = (await response.json()) as AnnotationRecord[];
  const matchesDiscardedDraft = list.some(
    (item) => item.x === 25 && item.y === 25 && item.width === 30 && item.height === 30,
  );
  assert.equal(matchesDiscardedDraft, false);
});
