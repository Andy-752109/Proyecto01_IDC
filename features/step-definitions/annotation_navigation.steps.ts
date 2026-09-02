// Step definitions for features/annotation_navigation.feature (SPEC-04)
//
// Reuses "I have an image loaded on the annotation canvas" from
// bounding_box_create_edit.steps.ts.

import { Given, Then, When } from '@cucumber/cucumber';

When('I increase the zoom level', () => {
  throw new Error('Not implemented yet');
});

Then('the image is displayed enlarged', () => {
  throw new Error('Not implemented yet');
});

Then('existing boxes keep their correct relative position', () => {
  throw new Error('Not implemented yet');
});

Given('I have just created a bounding box', () => {
  throw new Error('Not implemented yet');
});

When('I press undo', () => {
  throw new Error('Not implemented yet');
});

Then('the created box disappears from the canvas', () => {
  throw new Error('Not implemented yet');
});

Then('the previous state is restored', () => {
  throw new Error('Not implemented yet');
});

Given('I have annotated all necessary boxes on the current image', () => {
  throw new Error('Not implemented yet');
});

When('I press {string}', () => {
  throw new Error('Not implemented yet');
});

Then('the annotations are saved to the database', () => {
  throw new Error('Not implemented yet');
});

Then('the next pending image is displayed', () => {
  throw new Error('Not implemented yet');
});

Given('I have unsaved changes on the current image', () => {
  throw new Error('Not implemented yet');
});

When('I navigate to the previous image', () => {
  throw new Error('Not implemented yet');
});

Then('I am prompted to confirm whether I want to save the changes', () => {
  throw new Error('Not implemented yet');
});

When('I confirm that I want to save the changes', () => {
  throw new Error('Not implemented yet');
});

Then('the changes are saved to the database', () => {
  throw new Error('Not implemented yet');
});

Then('I am taken to the previous image', () => {
  throw new Error('Not implemented yet');
});

When('I choose to discard the changes', () => {
  throw new Error('Not implemented yet');
});

Then('the unsaved changes are not persisted', () => {
  throw new Error('Not implemented yet');
});
