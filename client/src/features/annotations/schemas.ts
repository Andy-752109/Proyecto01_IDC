import { z } from 'zod';

export const categorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
});
export const categoriesSchema = z.array(categorySchema);
export type Category = z.infer<typeof categorySchema>;

export const annotationSchema = z.object({
  id: z.number().int(),
  imageId: z.number().int(),
  categoryId: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
});
export type Annotation = z.infer<typeof annotationSchema>;

// Matches serializeImage() in server/src/routes/images.ts: the DB row plus
// a derived `url` pointing at GET /api/images/:id/file.
export const imageMetadataSchema = z.object({
  id: z.number().int(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  status: z.string(),
  url: z.string(),
});
export const imageResponseSchema = z.object({ image: imageMetadataSchema });
export type ImageMetadata = z.infer<typeof imageMetadataSchema>;

// GET /api/images returns { images: [...] } (see images.ts: imagesRouter.get('/', ...)).
export const imagesListResponseSchema = z.object({ images: z.array(imageMetadataSchema) });
