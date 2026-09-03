// Category, Annotation and ImageMetadata are now inferred from the Zod
// schemas in schemas.ts (Ajuste #2) instead of declared by hand here.
export type { Category, Annotation, ImageMetadata } from './schemas';

// A box that has been drawn on the canvas but not yet saved: no id yet (the
// server assigns it), no category yet (SPEC-03 — can't save without one).
// This one is a client-only construct, not something the server returns,
// so it doesn't need a Zod schema.
export type DraftAnnotation = {
  x: number;
  y: number;
  width: number;
  height: number;
};
