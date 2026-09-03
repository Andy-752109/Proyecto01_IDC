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
// care which one, only that it exists (T-04's upload flow isn't built yet).
export async function getAnySeededImageId(): Promise<number> {
  const [image] = await db.select().from(images).limit(1);
  if (!image) {
    throw new Error('No seeded images found. Did you run npm run db:seed?');
  }
  return image.id;
}
