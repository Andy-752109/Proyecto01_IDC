import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from './client';
import { annotations, categories, images } from './schema';
import { seed } from './seed';

async function dropAllTables(): Promise<void> {
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`DROP TABLE IF EXISTS annotations`);
  await db.execute(sql`DROP TABLE IF EXISTS images`);
  await db.execute(sql`DROP TABLE IF EXISTS categories`);
  await db.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

describe('migraciones sobre una base de datos vacía', () => {
  beforeAll(async () => {
    await dropAllTables();
  });

  it('crea todas las tablas del esquema sin intervención manual', async () => {
    await migrate(db, { migrationsFolder: './drizzle' });

    await expect(db.select().from(categories)).resolves.toEqual([]);
    await expect(db.select().from(images)).resolves.toEqual([]);
    await expect(db.select().from(annotations)).resolves.toEqual([]);
  });
});

describe('seeder idempotente', () => {
  it('inserta las categorías e imágenes de ejemplo', async () => {
    await seed();

    const categoryRows = await db.select().from(categories);
    const imageRows = await db.select().from(images);

    expect(categoryRows.length).toBeGreaterThan(0);
    expect(imageRows.length).toBeGreaterThan(0);
  });

  it('no duplica registros al ejecutarse más de una vez', async () => {
    const categoriesBefore = await db.select().from(categories);
    const imagesBefore = await db.select().from(images);

    await seed();
    await seed();

    const categoriesAfter = await db.select().from(categories);
    const imagesAfter = await db.select().from(images);

    expect(categoriesAfter).toHaveLength(categoriesBefore.length);
    expect(imagesAfter).toHaveLength(imagesBefore.length);
  });
});

afterAll(async () => {
  await pool.end();
});
