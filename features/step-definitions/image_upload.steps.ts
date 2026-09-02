// Step definitions for features/image_upload.feature (SPEC-01)
//
// RED PHASE: every step throws "Not implemented yet" on purpose. There is no
// upload endpoint, MinIO client wiring, or MariaDB metadata table yet (those
// land with T-01/T-03 and whoever implements the upload feature). Stubs are
// intentionally parameter-less (cucumber-js does not require callback arity
// to match capture groups); add params back when the real logic lands.

import { Given, Then, When } from '@cucumber/cucumber';

Given('I am logged into the portal', () => {
  throw new Error('Not implemented yet');
});

Given('the maximum allowed image size is {int}MB', () => {
  throw new Error('Not implemented yet');
});

Given('I select a file {string} of {int}MB', () => {
  throw new Error('Not implemented yet');
});

Given('I select a file {string}', () => {
  throw new Error('Not implemented yet');
});

When('I upload the image to the portal', () => {
  throw new Error('Not implemented yet');
});

When('I try to upload the file to the portal', () => {
  throw new Error('Not implemented yet');
});

Then('the image is stored in MinIO', () => {
  throw new Error('Not implemented yet');
});

Then('a metadata record is created in MariaDB', () => {
  throw new Error('Not implemented yet');
});

Then('I see a success message {string}', () => {
  throw new Error('Not implemented yet');
});

Then('the upload is rejected', () => {
  throw new Error('Not implemented yet');
});

Then('no record is created in MariaDB or MinIO', () => {
  throw new Error('Not implemented yet');
});

Then('I see an error message indicating the file type is not valid', () => {
  throw new Error('Not implemented yet');
});

Then('I see an error message indicating the file exceeds the maximum size', () => {
  throw new Error('Not implemented yet');
});

Then('the upload is accepted', () => {
  throw new Error('Not implemented yet');
});
