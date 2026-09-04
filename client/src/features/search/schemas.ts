import { z } from 'zod';
import { imageMetadataSchema } from '../annotations/schemas';

// GET /api/images/search response shape (see server/src/routes/images.ts).
export const searchResponseSchema = z.object({
  images: z.array(imageMetadataSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
