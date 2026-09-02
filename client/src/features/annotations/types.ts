export type Category = {
  id: number;
  name: string;
  color: string;
};

export type Annotation = {
  id: number;
  imageId: number;
  categoryId: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

// A box that has been drawn on the canvas but not yet saved: no id yet (the
// server assigns it), no category yet (SPEC-03 — can't save without one).
export type DraftAnnotation = {
  x: number;
  y: number;
  width: number;
  height: number;
};
