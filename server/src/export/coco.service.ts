import { db } from '../db/client';
import { annotations, categories, images } from '../db/schema';
import {
  type CocoAnnotation,
  type CocoCategory,
  type CocoDataset,
  type CocoImage,
  cocoDatasetSchema,
} from './coco.schema';

export interface CategoryRow {
  id: number;
  name: string;
}

export interface ImageRow {
  id: number;
  filename: string;
  width: number;
  height: number;
}

export interface AnnotationRow {
  id: number;
  imageId: number;
  categoryId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CocoSourceData {
  categories: CategoryRow[];
  images: ImageRow[];
  annotations: AnnotationRow[];
}

/**
 * Transforma filas ya obtenidas de la base de datos al formato COCO.
 */
export function buildCocoDataset(source: CocoSourceData): CocoDataset {
  const cocoCategories: CocoCategory[] = source.categories.map((category) => ({
    id: category.id,
    name: category.name,
    supercategory: 'none',
  }));

  const cocoImages: CocoImage[] = source.images.map((image) => ({
    id: image.id,
    file_name: image.filename,
    width: image.width,
    height: image.height,
  }));

  const cocoAnnotations: CocoAnnotation[] = source.annotations.map((annotation) => ({
    id: annotation.id,
    image_id: annotation.imageId,
    category_id: annotation.categoryId,
    bbox: [annotation.x, annotation.y, annotation.width, annotation.height],
    area: annotation.width * annotation.height,
    iscrowd: 0,
    segmentation: [],
  }));

  const dataset: CocoDataset = {
    info: {
      description: 'Dataset exportado desde el Portal de Anotación de Imágenes',
      version: '1.0',
      date_created: new Date().toISOString(),
    },
    licenses: [],
    images: cocoImages,
    annotations: cocoAnnotations,
    categories: cocoCategories,
  };

  return cocoDatasetSchema.parse(dataset);
}

/**
 * Obtiene el dataset completo desde MariaDB y lo transforma a formato COCO.
 */
export async function fetchCocoDataset(): Promise<CocoDataset> {
  const [categoryRows, imageRows, annotationRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(images),
    db.select().from(annotations),
  ]);

  return buildCocoDataset({
    categories: categoryRows,
    images: imageRows,
    annotations: annotationRows,
  });
}
