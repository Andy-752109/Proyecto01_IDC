// Step definitions for features/search_operators.feature (SPEC-08)
//
// The OR/NOT scenarios (and their steps below) implement the *assumed*
// scope documented in SPECS.md. If the professor confirms only AND is in
// scope, delete the OR/NOT scenarios from the .feature and their unused
// step definitions here.

import { Given, Then, When } from '@cucumber/cucumber';

Given('there are annotated images with categories {string} and {string}', () => {
  throw new Error('Not implemented yet');
});

When('I search {string}', () => {
  throw new Error('Not implemented yet');
});

Then('I get only the images that contain both categories', () => {
  throw new Error('Not implemented yet');
});

Given('there are annotated images with category {string} or category {string}', () => {
  throw new Error('Not implemented yet');
});

Then('I get the images that contain at least one of the two categories', () => {
  throw new Error('Not implemented yet');
});

Given('there are annotated images with category {string}, some of which also have {string}', () => {
  throw new Error('Not implemented yet');
});

Then('I get only the images that contain {string} and do not contain {string}', () => {
  throw new Error('Not implemented yet');
});

Given('no image has both categories {string} and {string} at the same time', () => {
  throw new Error('Not implemented yet');
});

Then('I get an empty list of results', () => {
  throw new Error('Not implemented yet');
});
