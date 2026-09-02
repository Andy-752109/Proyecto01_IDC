import { pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { db, pool } from './client';
import { categories, images } from './schema';

const exampleCategories = [
  { name: 'car', color: '#e63946' },
  { name: 'person', color: '#2a9d8f' },
  { name: 'dog', color: '#f4a261' },
  { name: 'bicycle', color: '#264653' },
] as const;

const exampleImages = [
  {
    filename: 'sample-street-01.jpg',
    storageKey: 'seed/sample-street-01.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 245_000,
    width: 1280,
    height: 720,
    status: 'pending' as const,
  },
  {
    filename: 'sample-park-01.jpg',
    storageKey: 'seed/sample-park-01.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 198_000,
    width: 1024,
    height: 768,
    status: 'pending' as const,
  },
  {
    filename: 'sample-plaza-01.jpg',
    storageKey: 'seed/sample-plaza-01.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 312_500,
    width: 1600,
    height: 900,
    status: 'pending' as const,
  },
];

export async function seed(): Promise<void> {
  for (const category of exampleCategories) {
    await db
      .insert(categories)
      .values(category)
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  }

  for (const image of exampleImages) {
    await db
      .insert(images)
      .values(image)
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
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
