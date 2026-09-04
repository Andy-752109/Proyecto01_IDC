import assert from 'node:assert/strict';
import { After, Given, Then, When } from '@cucumber/cucumber';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../server/src/db/client';
import { annotations, categories, images } from '../../server/src/db/schema';
import type { CocoDataset } from '../../server/src/export/coco.schema';
import { baseUrl } from '../support/hooks';

// SPEC-05 (features/coco_export_structure.feature): estructura COCO válida
// e IDs consistentes entre secciones.
// SPEC-06 (features/coco_bbox_format.feature): bbox/area/iscrowd correctos.
// SPEC-07 (features/coco_full_export.feature): exportación descargable del
// dataset completo, sin excluir nada.
//
// El servidor HTTP y el pool de MariaDB son compartidos con el resto de la
// suite (features/support/hooks.ts): este archivo no levanta su propio
// servidor ni cierra el pool, para no romper los demás escenarios cuando
// corren juntos en `npm run test:bdd`.

const TEST_CATEGORY_NAME = '__coco-export-test-category';

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
  return insertResult[0].insertId;
}

// --- Estado compartido entre steps de un mismo escenario ---
let lastDataset: CocoDataset | undefined;
let lastResponse: Response | undefined;
let imageWithoutAnnotationsId: number | undefined;
let bboxAnnotationId: number | undefined;
let bboxInput: { x: number; y: number; width: number; height: number } | undefined;

// El After global de features/support/hooks.ts ya vacía la tabla
// `annotations` completa después de cada escenario. Aquí solo limpiamos las
// imágenes que creamos nosotros (nadie más lo hace), lo que además cascadea
// el borrado de cualquier anotación que aún les quedara (onDelete: cascade).
After(async () => {
  if (createdImageIds.length > 0) {
    await db.delete(images).where(inArray(images.id, createdImageIds));
  }
  createdImageIds = [];
  // Borra la categoría de prueba también: como se crea con
  // onDuplicateKeyUpdate (upsert), si no se limpia queda contaminando la
  // tabla real de categorías para siempre — aparece en el dashboard, en el
  // selector de categorías del anotador, y hasta en el JSON exportado.
  // Ya no quedan anotaciones que la referencien (se borraron en cascada
  // arriba junto con sus imágenes), así que el delete es seguro.
  await db.delete(categories).where(eq(categories.name, TEST_CATEGORY_NAME));
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
