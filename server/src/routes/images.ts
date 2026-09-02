import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { type Request, type Response, Router } from 'express';
import { imageSize } from 'image-size';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { db } from '../db/client';
import { images } from '../db/schema';
import { IMAGES_BUCKET, ensureBucketExists, minioClient } from '../lib/minio';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
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
    await ensureBucketExists();
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
