// Step definitions for features/bounding_box_requires_category.feature (SPEC-03)
//
// Reuses "I have an image loaded on the annotation canvas", "I draw a box on
// the image" and "I select the category {string}" from
// bounding_box_create_edit.steps.ts — do not redefine them here or Cucumber
// will throw an ambiguous step definition error.

import { Given, Then, When } from '@cucumber/cucumber';

When('I do not select any category', () => {
  throw new Error('Not implemented yet');
});

Then('the box cannot be saved', () => {
  throw new Error('Not implemented yet');
});

Then('I see a message indicating that a valid class must be assigned', () => {
  throw new Error('Not implemented yet');
});

Given('I have drawn a box without a category', () => {
  throw new Error('Not implemented yet');
});

Then('the box is saved successfully', () => {
  throw new Error('Not implemented yet');
});
