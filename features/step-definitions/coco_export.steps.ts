import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { After, AfterAll, BeforeAll, Given, Then, When } from '@cucumber/cucumber';
import { eq, inArray, sql } from 'drizzle-orm';
import express from 'express';
import { db, pool } from '../../server/src/db/client';
import { annotations, categories, images } from '../../server/src/db/schema';
import { cocoExportRouter } from '../../server/src/export/coco.router';
import type { CocoDataset } from '../../server/src/export/coco.schema';

// SPEC-05 (features/coco_export_structure.feature): estructura COCO válida
// e IDs consistentes entre secciones.
// SPEC-06 (features/coco_bbox_format.feature): bbox/area/iscrowd correctos.
// SPEC-07 (features/coco_full_export.feature): exportación descargable del
// dataset completo, sin excluir nada.
//
// Este archivo levanta su propio servidor Express que monta únicamente
// `cocoExportRouter`, en vez de reusar el harness compartido de
// features/support/ (creado por T-04/T-05): el endpoint de exportación es
// de solo lectura sobre MariaDB y no depende de MinIO ni de subida de
// archivos, así que no necesita ese harness. Cuando ese harness quede
// establecido en main, este bootstrap se puede reemplazar por su
// `baseUrl` compartido sin tocar ninguno de los steps de abajo.

const TEST_CATEGORY_NAME = '__coco-export-test-category';

const app = express();
app.use('/api/export', cocoExportRouter);

let server: Server;
let baseUrl = '';

BeforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://localhost:${address.port}`;
});

AfterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

async function getOrCreateTestCategoryId(): Promise<number> {
  await db
    .insert(categories)
    .values({ name: TEST_CATEGORY_NAME, color: '#123456' })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.name, TEST_CATEGORY_NAME));
  assert.ok(category, 'No se pudo crear/leer la categoría de prueba');
  return category.id;
}

let imageCounter = 0;
let createdImageIds: number[] = [];
let createdAnnotationIds: number[] = [];

async function insertTestImage(width = 640, height = 480): Promise<number> {
  imageCounter += 1;
  const storageKey = `test/coco-export/${Date.now()}-${imageCounter}.jpg`;

  const insertResult = await db.insert(images).values({
    filename: `coco-export-test-${imageCounter}.jpg`,
    storageKey,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    width,
    height,
    status: 'pending',
  });
  const imageId = insertResult[0].insertId;
  createdImageIds.push(imageId);
  return imageId;
}

async function insertTestAnnotation(
  imageId: number,
  categoryId: number,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const insertResult = await db.insert(annotations).values({
    imageId,
    categoryId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  });
  const annotationId = insertResult[0].insertId;
  createdAnnotationIds.push(annotationId);
  return annotationId;
}

// --- Estado compartido entre steps de un mismo escenario ---
let lastDataset: CocoDataset | undefined;
let lastResponse: Response | undefined;
let imageWithoutAnnotationsId: number | undefined;
let bboxAnnotationId: number | undefined;
let bboxInput: { x: number; y: number; width: number; height: number } | undefined;

After(async () => {
  if (createdAnnotationIds.length > 0) {
    await db.delete(annotations).where(inArray(annotations.id, createdAnnotationIds));
  }
  if (createdImageIds.length > 0) {
    await db.delete(images).where(inArray(images.id, createdImageIds));
  }
  createdAnnotationIds = [];
  createdImageIds = [];
  lastDataset = undefined;
  lastResponse = undefined;
  imageWithoutAnnotationsId = undefined;
  bboxAnnotationId = undefined;
  bboxInput = undefined;
});

// --- Given ---

Given('there are annotated images with at least one category', async () => {
  const categoryId = await getOrCreateTestCategoryId();
  const imageId = await insertTestImage();
  await insertTestAnnotation(imageId, categoryId, { x: 0, y: 0, width: 10, height: 10 });
});

Given('there is an uploaded image with no bounding boxes', async () => {
  imageWithoutAnnotationsId = await insertTestImage();
});

Given(
  /^there is an annotation with a bounding box of (\d+)x(\d+) pixels at \((\d+), (\d+)\)$/,
  async (widthText: string, heightText: string, xText: string, yText: string) => {
    const categoryId = await getOrCreateTestCategoryId();
    const imageId = await insertTestImage();
    bboxInput = {
      x: Number(xText),
      y: Number(yText),
      width: Number(widthText),
      height: Number(heightText),
    };
    bboxAnnotationId = await insertTestAnnotation(imageId, categoryId, bboxInput);
  },
);

Given('the dataset has images and annotations saved', async () => {
  const categoryId = await getOrCreateTestCategoryId();
  const imageId = await insertTestImage();
  await insertTestAnnotation(imageId, categoryId, { x: 1, y: 1, width: 20, height: 15 });
});

// --- When ---

async function performExport(): Promise<void> {
  lastResponse = await fetch(`${baseUrl}/api/export/coco`);
  assert.equal(lastResponse.status, 200, 'La exportación no respondió 200');
  lastDataset = (await lastResponse.json()) as CocoDataset;
}

When('I export the dataset in COCO format', performExport);
When('I request to export the full dataset', performExport);

// --- Then ---

Then(
  'the JSON file contains the {string}, {string} and {string} sections',
  (first: string, second: string, third: string) => {
    assert.ok(lastDataset, 'No se generó ningún dataset todavía');
    for (const key of [first, second, third]) {
      assert.ok(
        Object.hasOwn(lastDataset as object, key),
        `El JSON no contiene la sección "${key}"`,
      );
    }
  },
);

Then(
  'each annotation references an {string} that exists in {string}',
  (field: string, section: string) => {
    assert.ok(lastDataset, 'No se generó ningún dataset todavía');
    assert.equal(field, 'image_id');
    assert.equal(section, 'images');
    const imageIds = new Set(lastDataset.images.map((image) => image.id));
    for (const annotation of lastDataset.annotations) {
      assert.ok(imageIds.has(annotation.image_id), `image_id ${annotation.image_id} no existe`);
    }
  },
);

Then(
  'each annotation references a {string} that exists in {string}',
  (field: string, section: string) => {
    assert.ok(lastDataset, 'No se generó ningún dataset todavía');
    assert.equal(field, 'category_id');
    assert.equal(section, 'categories');
    const categoryIds = new Set(lastDataset.categories.map((category) => category.id));
    for (const annotation of lastDataset.annotations) {
      assert.ok(
        categoryIds.has(annotation.category_id),
        `category_id ${annotation.category_id} no existe`,
      );
    }
  },
);

Then('the image appears in the {string} section', (section: string) => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.equal(section, 'images');
  assert.ok(imageWithoutAnnotationsId, 'No se creó la imagen sin anotaciones');
  const found = lastDataset.images.some((image) => image.id === imageWithoutAnnotationsId);
  assert.ok(found, 'La imagen sin anotaciones no aparece en la sección images');
});

Then('no annotation in {string} references it', (section: string) => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.equal(section, 'annotations');
  assert.ok(imageWithoutAnnotationsId, 'No se creó la imagen sin anotaciones');
  const referencesIt = lastDataset.annotations.some(
    (annotation) => annotation.image_id === imageWithoutAnnotationsId,
  );
  assert.equal(referencesIt, false, 'Una anotación referencia una imagen que no tiene cajas');
});

Then('the {string} field of that annotation is {string}', (field: string, expected: string) => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.equal(field, 'bbox');
  assert.ok(bboxAnnotationId, 'No se creó la anotación de prueba');
  const annotation = lastDataset.annotations.find((item) => item.id === bboxAnnotationId);
  assert.ok(annotation, 'No se encontró la anotación exportada');
  assert.equal(JSON.stringify(annotation.bbox), expected.replace(/\s/g, ''));
});

Then('the {string} field equals {int}', (field: string, expected: number) => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.equal(field, 'area');
  assert.ok(bboxAnnotationId, 'No se creó la anotación de prueba');
  const annotation = lastDataset.annotations.find((item) => item.id === bboxAnnotationId);
  assert.ok(annotation, 'No se encontró la anotación exportada');
  assert.equal(annotation.area, expected);
});

Then('the {string} field is present with value 0 or 1', (field: string) => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.equal(field, 'iscrowd');
  assert.ok(bboxAnnotationId, 'No se creó la anotación de prueba');
  const annotation = lastDataset.annotations.find((item) => item.id === bboxAnnotationId);
  assert.ok(annotation, 'No se encontró la anotación exportada');
  assert.ok(annotation.iscrowd === 0 || annotation.iscrowd === 1);
});

Then('a downloadable file is generated with all annotated images', () => {
  assert.ok(lastResponse, 'No se ejecutó ninguna exportación todavía');
  const disposition = lastResponse.headers.get('content-disposition');
  assert.ok(disposition, 'La respuesta no trae Content-Disposition');
  assert.match(disposition, /attachment/);
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  assert.ok(lastDataset.images.length > 0, 'El dataset exportado no trae imágenes');
});

Then('no image or annotation is excluded from the export', async () => {
  assert.ok(lastDataset, 'No se generó ningún dataset todavía');
  const [totalImages, totalAnnotations] = await Promise.all([
    db.select().from(images),
    db.select().from(annotations),
  ]);
  assert.equal(lastDataset.images.length, totalImages.length);
  assert.equal(lastDataset.annotations.length, totalAnnotations.length);
});
