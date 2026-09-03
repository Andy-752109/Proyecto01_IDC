// Shared mutable state across step-definition files for the current
// scenario. Cucumber's per-scenario `this` (World) would normally do this
// job, but it requires `function` callbacks (not arrow functions) to bind
// correctly — which conflicts with Biome's "prefer arrow functions" rule.
// A single shared object, reset before every scenario, is the simpler
// trade-off for a suite this size.

export type AnnotationRecord = {
  id: number;
  imageId: number;
  categoryId: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DrawnCoordinates = { x: number; y: number; width: number; height: number };

export const testState: {
  currentImageId: number | undefined;
  drawnCoordinates: DrawnCoordinates | undefined;
  lastResponse: Response | undefined;
  lastResponseBody: unknown;
  lastAnnotation: AnnotationRecord | undefined;
} = {
  currentImageId: undefined,
  drawnCoordinates: undefined,
  lastResponse: undefined,
  lastResponseBody: undefined,
  lastAnnotation: undefined,
};

export function resetTestState(): void {
  testState.currentImageId = undefined;
  testState.drawnCoordinates = undefined;
  testState.lastResponse = undefined;
  testState.lastResponseBody = undefined;
  testState.lastAnnotation = undefined;
}
