// Step definitions for features/coco_bbox_format.feature (SPEC-06)
//
// Reuses "I export the dataset in COCO format" from
// coco_export_structure.steps.ts.

import { Given, Then } from '@cucumber/cucumber';

Given(
  /^there is an annotation with a bounding box of (\d+)x(\d+) pixels at \((\d+), (\d+)\)$/,
  () => {
    throw new Error('Not implemented yet');
  },
);

Then('the {string} field of that annotation is {string}', () => {
  throw new Error('Not implemented yet');
});

Then('the {string} field equals {int}', () => {
  throw new Error('Not implemented yet');
});

Then('the {string} field is present with value 0 or 1', () => {
  throw new Error('Not implemented yet');
});
