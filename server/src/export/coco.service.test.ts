import { describe, expect, it } from 'vitest';
import { type CocoSourceData, buildCocoDataset } from './coco.service';

const fixture: CocoSourceData = {
  categories: [
    { id: 1, name: 'car' },
    { id: 2, name: 'person' },
  ],
  images: [
    { id: 10, storageKey: 'uploads/street-01.jpg', width: 1280, height: 720 },
    { id: 11, storageKey: 'uploads/park-01.jpg', width: 1024, height: 768 },
  ],
  annotations: [
    { id: 100, imageId: 10, categoryId: 1, x: 12, y: 20, width: 150, height: 80 },
    { id: 101, imageId: 10, categoryId: 2, x: 200, y: 40, width: 60, height: 120 },
    { id: 102, imageId: 11, categoryId: 1, x: 5, y: 5, width: 300, height: 200 },
  ],
};

describe('buildCocoDataset', () => {
  it('produce una estructura COCO válida con images, annotations y categories', () => {
    const dataset = buildCocoDataset(fixture);

    expect(Array.isArray(dataset.images)).toBe(true);
    expect(Array.isArray(dataset.annotations)).toBe(true);
    expect(Array.isArray(dataset.categories)).toBe(true);
  });

  it('incluye el dataset completo: todas las imágenes, categorías y anotaciones de origen', () => {
    const dataset = buildCocoDataset(fixture);

    expect(dataset.images).toHaveLength(fixture.images.length);
    expect(dataset.categories).toHaveLength(fixture.categories.length);
    expect(dataset.annotations).toHaveLength(fixture.annotations.length);
  });

  it('mantiene IDs consistentes: cada anotación referencia una imagen y categoría existentes', () => {
    const dataset = buildCocoDataset(fixture);

    const imageIds = new Set(dataset.images.map((image) => image.id));
    const categoryIds = new Set(dataset.categories.map((category) => category.id));

    for (const annotation of dataset.annotations) {
      expect(imageIds.has(annotation.image_id)).toBe(true);
      expect(categoryIds.has(annotation.category_id)).toBe(true);
    }
  });

  it('genera bbox en formato [x, y, width, height] en píxeles absolutos', () => {
    const dataset = buildCocoDataset(fixture);

    dataset.annotations.forEach((annotation, index) => {
      const source = fixture.annotations[index];
      expect(source).toBeDefined();
      if (!source) return;
      expect(annotation.bbox).toEqual([source.x, source.y, source.width, source.height]);
    });
  });

  it('calcula area coherente con width × height', () => {
    const dataset = buildCocoDataset(fixture);

    dataset.annotations.forEach((annotation, index) => {
      const source = fixture.annotations[index];
      expect(source).toBeDefined();
      if (!source) return;
      expect(annotation.area).toBe(source.width * source.height);
    });
  });

  it('incluye iscrowd en cada anotación', () => {
    const dataset = buildCocoDataset(fixture);

    for (const annotation of dataset.annotations) {
      expect(annotation.iscrowd === 0 || annotation.iscrowd === 1).toBe(true);
    }
  });

  it('rechaza datos que rompen las reglas COCO (medidas de bbox negativas)', () => {
    const brokenFixture: CocoSourceData = {
      ...fixture,
      annotations: [{ id: 999, imageId: 10, categoryId: 1, x: 0, y: 0, width: -5, height: 10 }],
    };

    expect(() => buildCocoDataset(brokenFixture)).toThrow();
  });
});
