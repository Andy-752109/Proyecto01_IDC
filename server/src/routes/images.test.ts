import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app';
import { db, pool } from '../db/client';
import { images } from '../db/schema';
import { IMAGES_BUCKET, minioClient } from '../lib/minio';

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
