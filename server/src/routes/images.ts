import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { type Request, type Response, Router } from 'express';
import { imageSize } from 'image-size';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { env } from '../config/env';
import { db } from '../db/client';
import { annotations, categories, imageStatusValues, images } from '../db/schema';
import { IMAGES_BUCKET, minioClient } from '../lib/minio';

export const MAX_IMAGE_SIZE_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

class UnsupportedImageTypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])
    ) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
});

const uploadedFileSchema = z.object({
  originalname: z.string().min(1),
  mimetype: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  buffer: z.instanceof(Buffer),
});

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '-');
}

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// PATCH /api/images/:id body — status transitions (e.g. "Guardar y
// siguiente" in T-06 moves pending -> annotated). Reuses the same enum the
// DB column is constrained to, so an invalid status is rejected before it
// ever reaches Drizzle.
const updateImageStatusSchema = z.object({
  status: z.enum(imageStatusValues),
});

// GET /api/images/search query params (SPEC-08 + SPEC-09, T-08).
// `categories` is a comma-separated list of category names — with one name
// it's the SPEC-09 "filter by class"; with several it's the SPEC-08 "car
// AND person" search (an image must have annotations in ALL of them, not
// just any). `page`/`pageSize` default so callers don't have to think
// about pagination unless they want a specific slice.
const searchQuerySchema = z.object({
  categories: z.string().trim().min(1).optional(),
  status: z.enum(imageStatusValues).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

function serializeImage(row: typeof images.$inferSelect) {
  return { ...row, url: `/api/images/${row.id}/file` };
}

function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

// Resolves the AND semantics of SPEC-08 with real SQL aggregation (GROUP BY
// + HAVING COUNT DISTINCT), not by fetching everything and filtering in
// JavaScript: an image only qualifies if it has at least one annotation in
// EVERY requested category, which is exactly what the HAVING clause checks.
async function findImageIdsMatchingAllCategories(categoryNames: string[]): Promise<number[]> {
  const rows = await db
    .select({ imageId: annotations.imageId })
    .from(annotations)
    .innerJoin(categories, eq(categories.id, annotations.categoryId))
    .where(inArray(categories.name, categoryNames))
    .groupBy(annotations.imageId)
    .having(sql`count(distinct ${categories.name}) = ${categoryNames.length}`);
  return rows.map((row) => row.imageId);
}

export const imagesRouter = Router();

imagesRouter.post('/', async (req, res, next) => {
  try {
    await runUpload(req, res);
  } catch (error) {
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: `El archivo excede el tamaño máximo permitido (${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB)`,
      });
      return;
    }
    if (error instanceof UnsupportedImageTypeError) {
      res.status(400).json({
        error: 'Tipo de archivo no soportado. Formatos permitidos: JPG, JPEG, PNG',
      });
      return;
    }
    next(error);
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No se recibió ningún archivo (campo "image" requerido)' });
    return;
  }

  const parsedFile = uploadedFileSchema.safeParse(req.file);
  if (!parsedFile.success) {
    res.status(400).json({ error: 'Archivo inválido' });
    return;
  }
  const file = parsedFile.data;

  let dimensions: { width: number; height: number };
  try {
    const size = imageSize(file.buffer);
    if (!size.width || !size.height) {
      throw new Error('missing dimensions');
    }
    dimensions = { width: size.width, height: size.height };
  } catch {
    res.status(400).json({ error: 'El archivo no es una imagen válida' });
    return;
  }

  const storageKey = `images/${randomUUID()}-${sanitizeFilename(file.originalname)}`;

  try {
    await minioClient.putObject(IMAGES_BUCKET, storageKey, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    const [result] = await db.insert(images).values({
      filename: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
    });

    const [created] = await db.select().from(images).where(eq(images.id, result.insertId));
    if (!created) {
      throw new Error('No se pudo leer el registro recién insertado');
    }

    res
      .status(201)
      .json({ message: 'Image uploaded successfully', image: serializeImage(created) });
  } catch (error) {
    next(error);
  }
});

imagesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select().from(images).orderBy(desc(images.createdAt));
    res.status(200).json({ images: rows.map(serializeImage) });
  } catch (error) {
    next(error);
  }
});

// GET /api/images/search — MUST be registered before GET /:id, or Express
// would try to match "search" as an :id param instead of reaching here
// (the exact route-order bug T-05 hit with /api/annotations earlier).
imagesRouter.get('/search', async (req, res, next) => {
  const parsedQuery = searchQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: 'Invalid search query', details: parsedQuery.error.flatten() });
    return;
  }
  const {
    categories: categoriesParam,
    status,
    dateFrom,
    dateTo,
    page,
    pageSize,
  } = parsedQuery.data;

  try {
    const conditions = [];

    if (categoriesParam) {
      const categoryNames = categoriesParam
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (categoryNames.length > 0) {
        const matchingIds = await findImageIdsMatchingAllCategories(categoryNames);
        if (matchingIds.length === 0) {
          // Nothing matches all requested categories — short-circuit with a
          // correctly-paginated empty result instead of calling inArray([]).
          res.status(200).json({ images: [], total: 0, page, pageSize });
          return;
        }
        conditions.push(inArray(images.id, matchingIds));
      }
    }

    if (status) {
      conditions.push(eq(images.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(images.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(images.createdAt, dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db.select({ value: count() }).from(images).where(whereClause);

    const rows = await db
      .select()
      .from(images)
      .where(whereClause)
      .orderBy(desc(images.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.status(200).json({
      images: rows.map(serializeImage),
      total: totalRow?.value ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
});

imagesRouter.get('/:id', async (req, res, next) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: 'El id de la imagen no es válido' });
    return;
  }

  try {
    const [row] = await db.select().from(images).where(eq(images.id, parsedParams.data.id));
    if (!row) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }
    res.status(200).json({ image: serializeImage(row) });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/images/:id — update the image's status. Owned by T-06: this is
// what "Guardar y siguiente" calls to transition pending -> annotated, so
// the dashboard's "imágenes anotadas" metric reflects real progress.
imagesRouter.patch('/:id', async (req, res, next) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: 'El id de la imagen no es válido' });
    return;
  }

  const parsedBody = updateImageStatusSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Invalid status', details: parsedBody.error.flatten() });
    return;
  }

  try {
    const [existing] = await db.select().from(images).where(eq(images.id, parsedParams.data.id));
    if (!existing) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }

    await db
      .update(images)
      .set({ status: parsedBody.data.status })
      .where(eq(images.id, parsedParams.data.id));

    const [updated] = await db.select().from(images).where(eq(images.id, parsedParams.data.id));
    if (!updated) {
      throw new Error('No se pudo leer el registro actualizado');
    }
    res.status(200).json({ image: serializeImage(updated) });
  } catch (error) {
    next(error);
  }
});

imagesRouter.get('/:id/file', async (req, res, next) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: 'El id de la imagen no es válido' });
    return;
  }

  try {
    const [row] = await db.select().from(images).where(eq(images.id, parsedParams.data.id));
    if (!row) {
      res.status(404).json({ error: 'Imagen no encontrada' });
      return;
    }

    const objectStream = await minioClient.getObject(IMAGES_BUCKET, row.storageKey);
    res.status(200).set({
      'Content-Type': row.mimeType,
      'Content-Length': String(row.sizeBytes),
    });
    objectStream.on('error', next);
    objectStream.pipe(res);
  } catch (error) {
    next(error);
  }
});
