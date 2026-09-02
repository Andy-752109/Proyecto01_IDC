import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { baseUrl } from '../support/hooks';
import { getAnySeededImageId } from '../support/testData';
import { testState } from '../support/testState';

// Reuses "I have an image loaded on the annotation canvas", "I draw a box on
// the image" and "I select the category {string}" from
// bounding_box_create_edit.steps.ts — do not redefine them here.

When('I do not select any category', async () => {
  if (!testState.drawnCoordinates || testState.currentImageId === undefined) {
    throw new Error('No box has been drawn on an image yet');
  }
  testState.lastResponse = await fetch(`${baseUrl}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // categoryId intentionally omitted — this is exactly the SPEC-03 case.
    body: JSON.stringify({ imageId: testState.currentImageId, ...testState.drawnCoordinates }),
  });
  testState.lastResponseBody = await testState.lastResponse.json();
});

Then('the box cannot be saved', () => {
  assert.equal(testState.lastResponse?.status, 400);
});

Then('I see a message indicating that a valid class must be assigned', () => {
  const message = JSON.stringify(testState.lastResponseBody).toLowerCase();
  assert.match(message, /categoryid|category/);
});

Given('I have drawn a box without a category', async () => {
  testState.currentImageId = await getAnySeededImageId();
  testState.drawnCoordinates = { x: 20, y: 20, width: 40, height: 40 };
});

Then('the box is saved successfully', () => {
  assert.equal(testState.lastResponse?.status, 201);
});
