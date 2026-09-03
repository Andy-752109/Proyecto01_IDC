import { z } from 'zod';

// La UI nunca habla con MariaDB directo: todo pasa por /api/dashboard/*.

export const summarySchema = z.object({
  totalImages: z.number(),
  annotatedImages: z.number(),
  totalBoundingBoxes: z.number(),
  totalCategories: z.number(),
});

export type DashboardSummary = z.infer<typeof summarySchema>;

export const objectsByCategorySchema = z.object({
  objectsByCategory: z.array(
    z.object({
      categoryId: z.number(),
      categoryName: z.string(),
      color: z.string(),
      objectCount: z.number(),
    }),
  ),
});

export type ObjectsByCategory = z.infer<typeof objectsByCategorySchema>['objectsByCategory'];

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url} (status ${response.status})`);
  }
  return schema.parse(await response.json());
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return getJson('/api/dashboard/summary', summarySchema);
}

export function fetchObjectsByCategory(): Promise<ObjectsByCategory> {
  return getJson('/api/dashboard/objects-by-category', objectsByCategorySchema).then(
    (body) => body.objectsByCategory,
  );
}
