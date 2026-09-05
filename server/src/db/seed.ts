import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { IMAGES_BUCKET, ensureBucketExists, minioClient } from '../lib/minio';
import { db, pool } from './client';
import { categories, images } from './schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedAssetsDir = path.resolve(__dirname, 'seed-assets');

const exampleCategories = [
  { name: 'car', color: '#e63946' },
  { name: 'person', color: '#2a9d8f' },
  { name: 'dog', color: '#f4a261' },
  { name: 'bicycle', color: '#264653' },
] as const;

// Los tres .jpg reales viven en server/src/db/seed-assets/. El tamaño en
// bytes se calcula del archivo real (no se inventa), para que la fila de
// la BD siempre sea coherente con el objeto que de verdad se sube a MinIO.
const sampleFiles = [
  { filename: 'sample-street-01.jpg', width: 1280, height: 720 },
  { filename: 'sample-park-01.jpg', width: 1024, height: 768 },
  { filename: 'sample-plaza-01.jpg', width: 1600, height: 900 },
] as const;

function buildExampleImages() {
  return sampleFiles.map((file) => {
    const buffer = readFileSync(path.join(seedAssetsDir, file.filename));
    return {
      filename: file.filename,
      storageKey: `seed/${file.filename}`,
      mimeType: 'image/jpeg' as const,
      sizeBytes: buffer.length,
      width: file.width,
      height: file.height,
      status: 'pending' as const,
      buffer,
    };
  });
}

export async function seed(): Promise<void> {
  for (const category of exampleCategories) {
    await db
      .insert(categories)
      .values(category)
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  }

  // Necesario para poder subir los objetos si el seeder corre antes de que
  // el servidor haya arrancado una sola vez (ej. en un clon limpio).
  await ensureBucketExists();

  for (const image of buildExampleImages()) {
    const { buffer, ...row } = image;
    await db
      .insert(images)
      .values(row)
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    // putObject sobrescribe el mismo key en cada corrida: subir la imagen
    // de nuevo no duplica nada en MinIO, así que el seeder sigue siendo
    // idempotente igual que antes.
    await minioClient.putObject(IMAGES_BUCKET, row.storageKey, buffer, buffer.length, {
      'Content-Type': row.mimeType,
    });
  }
}

async function main(): Promise<void> {
  console.info('Ejecutando seeder...');
  await seed();
  console.info('Seeder ejecutado correctamente.');
  await pool.end();
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error) => {
    console.error('Error al ejecutar el seeder:', error);
    process.exit(1);
  });
}
