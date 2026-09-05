import { z } from 'zod';

// Shared coordinate rules: absolute pixels, matches the `annotations` table
// (x, y, width, height are all `int` in db/schema.ts).
const annotationCoordinatesSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// POST /api/annotations body.
// categoryId is required here — this is what enforces SPEC-03 ("no box
// without a valid class") at the schema level: a missing/non-numeric
// categoryId fails validation before the route even checks the database.
export const createAnnotationSchema = z
  .object({
    imageId: z.number().int().positive(),
    categoryId: z.number().int().positive(),
  })
  .merge(annotationCoordinatesSchema);

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;

// PATCH /api/annotations/:id body.
// All coordinate fields optional (move only sends x/y, resize only sends
// width/height), but at least one must be present or there's nothing to update.
export const updateAnnotationSchema = annotationCoordinatesSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one of x, y, width, height must be provided',
  });

export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;

// GET /api/annotations?imageId=... query params (SPEC-02 reload, T-06).
// z.coerce.number() because query params always arrive as strings.
export const listAnnotationsQuerySchema = z.object({
  imageId: z.coerce.number().int().positive(),
});

export type ListAnnotationsQuery = z.infer<typeof listAnnotationsQuerySchema>;

export const annotationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
