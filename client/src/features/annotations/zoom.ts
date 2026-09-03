export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

export function zoomIn(current: number): number {
  return Math.min(MAX_ZOOM, Math.round((current + ZOOM_STEP) * 100) / 100);
}

export function zoomOut(current: number): number {
  return Math.max(MIN_ZOOM, Math.round((current - ZOOM_STEP) * 100) / 100);
}

// Konva's getPointerPosition() returns screen pixels within the canvas
// element, NOT adjusted for the Stage's own scale. Dividing by zoom
// recovers the "world" (image-pixel) coordinate — what boxes are actually
// drawn and saved with, regardless of how zoomed in/out the view is.
export function toWorldPoint(
  pointer: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return { x: pointer.x / zoom, y: pointer.y / zoom };
}
