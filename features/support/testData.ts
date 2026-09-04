import { eq } from 'drizzle-orm';
import { db } from '../../server/src/db/client';
import { categories, images } from '../../server/src/db/schema';

// Look up a seeded category by name instead of hardcoding an id — ids can
// shift if the seeder ever changes order, but names ("car", "person",
// "dog", "bicycle") are stable and asserted unique by the schema.
export async function getCategoryIdByName(name: string): Promise<number> {
  const [category] = await db.select().from(categories).where(eq(categories.name, name)).limit(1);
  if (!category) {
    throw new Error(`Seeded category "${name}" not found. Did you run npm run db:seed?`);
  }
  return category.id;
}

// Any seeded image works as a valid imageId for annotation tests — we don't
// care which one, only that it exists.
export async function getAnySeededImageId(): Promise<number> {
  const [image] = await db.select().from(images).limit(1);
  if (!image) {
    throw new Error('No seeded images found. Did you run npm run db:seed?');
  }
  return image.id;
}

// Several DISTINCT seeded image ids at once — needed for scenarios that
// compare multiple images against each other (e.g. "this one should match
// the search, that one shouldn't"). Overloaded for the common counts (2, 3)
// so destructuring the result gives properly non-undefined types instead of
// `number | undefined` per element — noUncheckedIndexedAccess can't prove
// array length from a plain `number[]` return type, but a tuple type lets
// TypeScript know exactly how many elements to expect.
export async function getSeededImageIds(count: 2): Promise<[number, number]>;
export async function getSeededImageIds(count: 3): Promise<[number, number, number]>;
export async function getSeededImageIds(count: number): Promise<number[]>;
export async function getSeededImageIds(count: number): Promise<number[]> {
  const rows = await db.select({ id: images.id }).from(images).limit(count);
  if (rows.length < count) {
    throw new Error(
      `Expected at least ${count} seeded images, found ${rows.length}. Did you run npm run db:seed?`,
    );
  }
  return rows.map((row) => row.id) as number[];
}
