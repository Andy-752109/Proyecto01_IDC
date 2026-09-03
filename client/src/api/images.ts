import { z } from 'zod';

// La UI nunca habla con MariaDB/MinIO directo: todo pasa por /api/images.
// Estos esquemas validan lo que responde el backend (dato externo desde
// el punto de vista del frontend), en vez de confiar ciegamente en el JSON.

export const imageSchema = z.object({
  id: z.number(),
  filename: z.string(),
  storageKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  width: z.number(),
  height: z.number(),
  status: z.enum(['pending', 'annotated', 'reviewed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string(),
});

export type ApiImage = z.infer<typeof imageSchema>;

const listResponseSchema = z.object({ images: z.array(imageSchema) });
const uploadResponseSchema = z.object({ message: z.string(), image: imageSchema });
const errorResponseSchema = z.object({ error: z.string() });

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : fallback;
}

export async function fetchImages(): Promise<ApiImage[]> {
  const response = await fetch('/api/images');
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'No se pudieron cargar las imágenes'));
  }
  const body = await response.json();
  return listResponseSchema.parse(body).images;
}

export async function uploadImage(file: File): Promise<ApiImage> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/images', { method: 'POST', body: formData });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'No se pudo subir la imagen'));
  }
  const body = await response.json();
  return uploadResponseSchema.parse(body).image;
}
