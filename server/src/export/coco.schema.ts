import { z } from 'zod';

export const cocoCategorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  supercategory: z.string().min(1),
});

export const cocoImageSchema = z.object({
  id: z.number().int().positive(),
  file_name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// [x, y, width, height] en píxeles absolutos
export const cocoBboxSchema = z.tuple([
  z.number(),
  z.number(),
  z.number().nonnegative(),
  z.number().nonnegative(),
]);

export const cocoAnnotationSchema = z.object({
  id: z.number().int().positive(),
  image_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  bbox: cocoBboxSchema,
  area: z.number().nonnegative(),
  iscrowd: z.union([z.literal(0), z.literal(1)]),
  segmentation: z.array(z.array(z.number())),
});

export const cocoDatasetSchema = z.object({
  info: z.object({
    description: z.string(),
    version: z.string(),
    date_created: z.string(),
  }),
  licenses: z.array(z.unknown()),
  images: z.array(cocoImageSchema),
  annotations: z.array(cocoAnnotationSchema),
  categories: z.array(cocoCategorySchema),
});

export type CocoCategory = z.infer<typeof cocoCategorySchema>;
export type CocoImage = z.infer<typeof cocoImageSchema>;
export type CocoBbox = z.infer<typeof cocoBboxSchema>;
export type CocoAnnotation = z.infer<typeof cocoAnnotationSchema>;
export type CocoDataset = z.infer<typeof cocoDatasetSchema>;
