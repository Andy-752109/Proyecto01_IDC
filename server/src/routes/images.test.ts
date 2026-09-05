import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app';
import { db, pool } from '../db/client';
import { images } from '../db/schema';
import { IMAGES_BUCKET, ensureBucketExists, minioClient } from '../lib/minio';

// SPEC-01 (features/image_upload.feature): solo se aceptan imágenes de tipo
// y tamaño válidos, con feedback al usuario.

// El PNG más pequeño posible (1x1, transparente).
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// El JPEG más pequeño posible (1x1).
const VALID_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
  'base64',
);

const ONE_MB = 1024 * 1024;

const app = createApiApp();
const createdImageIds: number[] = [];
const createdStorageKeys: string[] = [];

async function trackCreatedImage(body: { image?: { id: number; storageKey: string } }) {
  if (body.image) {
    createdImageIds.push(body.image.id);
    createdStorageKeys.push(body.image.storageKey);
  }
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
  await ensureBucketExists();
});

afterAll(async () => {
  for (const id of createdImageIds) {
    await db.delete(images).where(eq(images.id, id));
  }
  for (const key of createdStorageKeys) {
    await minioClient.removeObject(IMAGES_BUCKET, key).catch(() => undefined);
  }
  await pool.end();
});

describe('POST /api/images', () => {
  it('acepta una imagen válida: la guarda en MinIO y crea el registro en MariaDB', async () => {
    const response = await request(app)
      .post('/api/images')
      .attach('image', VALID_JPEG, { filename: 'cat.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Image uploaded successfully');
    expect(response.body.image).toMatchObject({
      filename: 'cat.jpg',
      mimeType: 'image/jpeg',
      width: 1,
      height: 1,
    });
    await trackCreatedImage(response.body);

    const stat = await minioClient.statObject(IMAGES_BUCKET, response.body.image.storageKey);
    expect(stat.size).toBe(VALID_JPEG.length);
  });

  it('rechaza un archivo de tipo no soportado y no crea nada en MariaDB ni MinIO', async () => {
    const before = await db.select().from(images);

    const response = await request(app)
      .post('/api/images')
      .attach('image', Buffer.from('%PDF-1.4 not a real pdf'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/tipo de archivo/i);

    const after = await db.select().from(images);
    expect(after).toHaveLength(before.length);
  });

  it('rechaza un archivo que excede el tamaño máximo (10MB)', async () => {
    const oversized = Buffer.concat([VALID_PNG, Buffer.alloc(11 * ONE_MB)]);

    const response = await request(app)
      .post('/api/images')
      .attach('image', oversized, { filename: 'panorama.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/tamaño máximo/i);
  });

  it.each(['jpg', 'jpeg', 'png'])('acepta el formato soportado .%s', async (extension) => {
    const isPng = extension === 'png';
    const buffer = isPng ? VALID_PNG : VALID_JPEG;
    const contentType = isPng ? 'image/png' : 'image/jpeg';

    const response = await request(app)
      .post('/api/images')
      .attach('image', buffer, { filename: `image.${extension}`, contentType });

    expect(response.status).toBe(201);
    await trackCreatedImage(response.body);
  });
});

describe('GET /api/images', () => {
  it('lista las imágenes existentes, más reciente primero, con url para mostrarlas', async () => {
    const upload = await request(app)
      .post('/api/images')
      .attach('image', VALID_JPEG, { filename: 'listtest.jpg', contentType: 'image/jpeg' });
    await trackCreatedImage(upload.body);

    const response = await request(app).get('/api/images');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.images)).toBe(true);
    const found = response.body.images.find(
      (image: { id: number }) => image.id === upload.body.image.id,
    );
    expect(found).toMatchObject({
      filename: 'listtest.jpg',
      url: `/api/images/${upload.body.image.id}/file`,
    });
  });
});

describe('GET /api/images/:id', () => {
  it('devuelve la metadata de una imagen existente', async () => {
    const upload = await request(app)
      .post('/api/images')
      .attach('image', VALID_PNG, { filename: 'detail.png', contentType: 'image/png' });
    await trackCreatedImage(upload.body);
    const id = upload.body.image.id;

    const response = await request(app).get(`/api/images/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.image).toMatchObject({
      id,
      filename: 'detail.png',
      width: 1,
      height: 1,
      url: `/api/images/${id}/file`,
    });
  });

  it('responde 404 si la imagen no existe', async () => {
    const response = await request(app).get('/api/images/999999999');
    expect(response.status).toBe(404);
  });

  it('responde 400 si el id no es válido', async () => {
    const response = await request(app).get('/api/images/no-es-un-id');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/images/:id/file', () => {
  it('sirve los bytes reales de la imagen almacenada en MinIO', async () => {
    const upload = await request(app)
      .post('/api/images')
      .attach('image', VALID_PNG, { filename: 'file-test.png', contentType: 'image/png' });
    await trackCreatedImage(upload.body);
    const id = upload.body.image.id;

    const response = await request(app).get(`/api/images/${id}/file`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(response.body as Buffer, VALID_PNG)).toBe(0);
  });

  it('responde 404 si la imagen no existe', async () => {
    const response = await request(app).get('/api/images/999999999/file');
    expect(response.status).toBe(404);
  });

  it('responde 404 en JSON si el registro existe en MariaDB pero el objeto no está en MinIO', async () => {
    // Simula un registro cuya metadata existe en MariaDB pero cuyo archivo
    // nunca llegó a MinIO (ej. datos de seed sin objeto real detrás).
    const [result] = await db.insert(images).values({
      filename: 'huerfano.png',
      storageKey: 'images/no-existe-en-minio.png',
      mimeType: 'image/png',
      sizeBytes: 1,
      width: 1,
      height: 1,
    });
    createdImageIds.push(result.insertId);

    const response = await request(app).get(`/api/images/${result.insertId}/file`);

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body.error).toBe('El archivo de la imagen no existe en el almacenamiento');
  });
});
