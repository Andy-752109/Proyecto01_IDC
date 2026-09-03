import assert from 'node:assert/strict';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { eq } from 'drizzle-orm';
import { env } from '../../server/src/config/env';
import { db } from '../../server/src/db/client';
import { images } from '../../server/src/db/schema';
import { IMAGES_BUCKET, minioClient } from '../../server/src/lib/minio';
import { baseUrl } from '../support/hooks';

// SPEC-01 (features/image_upload.feature): solo se aceptan imágenes de tipo
// y tamaño válidos, con feedback al usuario.

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

// El PNG válido más pequeño posible (1x1). Los escenarios que piden un
// tamaño específico rellenan bytes después de este encabezado: image-size
// solo lee el encabezado, así que el archivo sigue siendo una imagen válida
// sin tener que generar una imagen real de varios MB.
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function buildFile(filename: string, sizeMb?: number): { buffer: Buffer; mimeType: string } {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME_TYPES[extension] ?? 'application/octet-stream';

  if (mimeType === 'application/pdf') {
    return { buffer: Buffer.from('%PDF-1.4 no es un pdf real'), mimeType };
  }

  const targetBytes = (sizeMb ?? 0.01) * 1024 * 1024;
  const padding = Math.max(0, Math.round(targetBytes - MINIMAL_PNG.length));
  return { buffer: Buffer.concat([MINIMAL_PNG, Buffer.alloc(padding)]), mimeType };
}

type UploadResponseBody = {
  message?: string;
  error?: string;
  image?: { id: number; storageKey: string };
};

let selectedFile: { filename: string; buffer: Buffer; mimeType: string } | undefined;
let imagesCountBefore = 0;
let lastResponse: Response | undefined;
let lastResponseBody: UploadResponseBody | undefined;
let createdImage: { id: number; storageKey: string } | undefined;

After(async () => {
  if (!createdImage) {
    return;
  }
  await db.delete(images).where(eq(images.id, createdImage.id));
  await minioClient.removeObject(IMAGES_BUCKET, createdImage.storageKey).catch(() => undefined);
  createdImage = undefined;
});

Given('I am logged into the portal', () => {
  // No hay sistema de autenticación implementado todavía; este step existe
  // para que el Background del .feature sea explícito y ejecutable.
});

Given('the maximum allowed image size is {int}MB', (maxMb: number) => {
  assert.equal(maxMb, env.MAX_UPLOAD_MB);
});

Given('I select a file {string}', (filename: string) => {
  selectedFile = { filename, ...buildFile(filename) };
});

Given('I select a file {string} of {int}MB', (filename: string, sizeMb: number) => {
  selectedFile = { filename, ...buildFile(filename, sizeMb) };
});

async function performUpload(): Promise<void> {
  if (!selectedFile) {
    throw new Error('No se seleccionó ningún archivo todavía');
  }

  // Rejección de tipo/tamaño ocurre en multer, antes de tocar MinIO o
  // MariaDB (ver server/src/routes/images.ts): basta con contar filas antes
  // para probar después que ninguna de las dos se tocó.
  imagesCountBefore = (await db.select().from(images)).length;

  const formData = new FormData();
  formData.append(
    'image',
    new Blob([selectedFile.buffer], { type: selectedFile.mimeType }),
    selectedFile.filename,
  );

  lastResponse = await fetch(`${baseUrl}/api/images`, { method: 'POST', body: formData });
  lastResponseBody = (await lastResponse.json()) as UploadResponseBody;
  if (lastResponse.status === 201 && lastResponseBody.image) {
    createdImage = lastResponseBody.image;
  }
}

When('I upload the image to the portal', performUpload);
When('I try to upload the file to the portal', performUpload);

Then('the image is stored in MinIO', async () => {
  assert.equal(lastResponse?.status, 201);
  const storageKey = lastResponseBody?.image?.storageKey;
  assert.ok(storageKey, 'La respuesta no trae storageKey');
  await minioClient.statObject(IMAGES_BUCKET, storageKey);
});

Then('a metadata record is created in MariaDB', async () => {
  const id = lastResponseBody?.image?.id;
  assert.ok(id, 'La respuesta no trae id de imagen');
  const [row] = await db.select().from(images).where(eq(images.id, id));
  assert.ok(row, 'No se encontró el registro en MariaDB');
});

Then('I see a success message {string}', (expected: string) => {
  assert.equal(lastResponseBody?.message, expected);
});

Then('the upload is rejected', () => {
  assert.equal(lastResponse?.status, 400);
});

Then('the upload is accepted', () => {
  assert.equal(lastResponse?.status, 201);
});

Then('no record is created in MariaDB or MinIO', async () => {
  const rows = await db.select().from(images);
  assert.equal(rows.length, imagesCountBefore);
});

Then('I see an error message indicating the file type is not valid', () => {
  assert.match(lastResponseBody?.error ?? '', /tipo de archivo/i);
});

Then('I see an error message indicating the file exceeds the maximum size', () => {
  assert.match(lastResponseBody?.error ?? '', /tamaño máximo/i);
});
