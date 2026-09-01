import { relations } from 'drizzle-orm';
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

// --- Categorías ---
export const categories = mysqlTable(
  'categories',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(), // hex, ej. #e63946
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('categories_name_unique_idx').on(table.name)],
);

// --- Imágenes ---
export const imageStatusValues = ['pending', 'annotated', 'reviewed'] as const;
export type ImageStatus = (typeof imageStatusValues)[number];

export const images = mysqlTable(
  'images',
  {
    id: int('id').autoincrement().primaryKey(),
    filename: varchar('filename', { length: 255 }).notNull(),
    // Referencia al objeto en MinIO (bucket fijo = env.MINIO_BUCKET, ver lib/minio.ts)
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: int('size_bytes').notNull(),
    width: int('width').notNull(),
    height: int('height').notNull(),
    status: mysqlEnum('status', imageStatusValues).notNull().default('pending'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('images_storage_key_unique_idx').on(table.storageKey),
    index('images_status_idx').on(table.status),
    index('images_created_at_idx').on(table.createdAt),
  ],
);

// --- Anotaciones (bounding boxes) ---
export const annotations = mysqlTable(
  'annotations',
  {
    id: int('id').autoincrement().primaryKey(),
    imageId: int('image_id')
      .notNull()
      .references(() => images.id, { onDelete: 'cascade' }),
    categoryId: int('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    // Píxeles absolutos, esquina superior izquierda + ancho/alto (compatible con COCO)
    x: int('x').notNull(),
    y: int('y').notNull(),
    width: int('width').notNull(),
    height: int('height').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('annotations_image_id_idx').on(table.imageId),
    index('annotations_category_id_idx').on(table.categoryId),
  ],
);

// --- Relaciones (para queries tipo db.query.images.findMany({ with: { annotations: true } })) ---
export const categoriesRelations = relations(categories, ({ many }) => ({
  annotations: many(annotations),
}));

export const imagesRelations = relations(images, ({ many }) => ({
  annotations: many(annotations),
}));

export const annotationsRelations = relations(annotations, ({ one }) => ({
  image: one(images, { fields: [annotations.imageId], references: [images.id] }),
  category: one(categories, { fields: [annotations.categoryId], references: [categories.id] }),
}));