// Step definitions for features/bounding_box_create_edit.feature (SPEC-02)
//
// RED PHASE: no Konva canvas, no annotations table exist yet. Steps that
// need to match literal parentheses, e.g. "position (150, 120)", use a
// RegExp instead of a Cucumber Expression, since () has special meaning
// (optional text) in Cucumber Expressions. Stubs are parameter-less on
// purpose; add params back when the real logic lands.

import { Given, Then, When } from '@cucumber/cucumber';

Given('I have an image loaded on the annotation canvas', () => {
  throw new Error('Not implemented yet');
});

Given('the category {string} exists with color {string}', () => {
  throw new Error('Not implemented yet');
});

When('I draw a box on the image', () => {
  throw new Error('Not implemented yet');
});

When('I select the category {string}', () => {
  throw new Error('Not implemented yet');
});

Then('the box is saved with the drawn coordinates', () => {
  throw new Error('Not implemented yet');
});

Then('the box is displayed with the color of the {string} category', () => {
  throw new Error('Not implemented yet');
});

Given(/^a box with category "([^"]+)" exists at position \((\d+), (\d+)\)$/, () => {
  throw new Error('Not implemented yet');
});

When(/^I drag the box to position \((\d+), (\d+)\)$/, () => {
  throw new Error('Not implemented yet');
});

Then(/^the box is updated to position \((\d+), (\d+)\)$/, () => {
  throw new Error('Not implemented yet');
});

Then('the change is persisted in the database', () => {
  throw new Error('Not implemented yet');
});

Given('a box with width {int} and height {int} exists', () => {
  throw new Error('Not implemented yet');
});

When('I drag the bottom-right corner of the box to a new point', () => {
  throw new Error('Not implemented yet');
});

Then('the width and height of the box are updated', () => {
  throw new Error('Not implemented yet');
});

Given('a box with category {string} exists', () => {
  throw new Error('Not implemented yet');
});

When('I delete the box', () => {
  throw new Error('Not implemented yet');
});

Then('the box no longer appears on the canvas', () => {
  throw new Error('Not implemented yet');
});

Then('the annotation record is removed from the database', () => {
  throw new Error('Not implemented yet');
});

Given('I have created and saved a box with category {string}', () => {
  throw new Error('Not implemented yet');
});

When('I reload the annotation page', () => {
  throw new Error('Not implemented yet');
});

Then('the saved box is displayed at its original position and size', () => {
  throw new Error('Not implemented yet');
});
