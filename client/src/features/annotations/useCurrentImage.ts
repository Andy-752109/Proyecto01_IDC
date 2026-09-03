import { useCallback, useEffect, useState } from 'react';
import { imagesListResponseSchema } from './schemas';
import type { ImageMetadata } from './schemas';

type UseCurrentImageResult =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | {
      status: 'ready';
      image: ImageMetadata;
      hasNext: boolean;
      hasPrevious: boolean;
      goToNext: () => void;
      goToPrevious: () => void;
    };

// Fetches the full image list once (ordered by createdAt desc, so index 0
// is the most recent — the same starting point as before navigation
// existed) and tracks which one is "current" by index. Plain sequential
// navigation through the list; "next pending image" (save-and-next) is a
// separate, more specific behavior built on top of this later.
export function useCurrentImage(): UseCurrentImageResult {
  const [images, setImages] = useState<ImageMetadata[] | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/images')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las imágenes.');
        }
        const data: unknown = await response.json();
        const parsed = imagesListResponseSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error('La respuesta de imágenes no tiene el formato esperado.');
        }
        if (!cancelled) {
          setImages(parsed.data.images);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Error desconocido.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goToNext = useCallback(() => {
    setIndex((current) => (images ? Math.min(images.length - 1, current + 1) : current));
  }, [images]);

  const goToPrevious = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  if (error) {
    return { status: 'error', message: error };
  }
  if (images === undefined) {
    return { status: 'loading' };
  }
  if (images.length === 0) {
    return { status: 'empty' };
  }

  const clampedIndex = Math.min(index, images.length - 1);
  const image = images[clampedIndex];
  if (!image) {
    // Unreachable given the bounds above (images.length > 0 and clampedIndex
    // stays within range), but noUncheckedIndexedAccess can't prove that —
    // this guard keeps TypeScript happy and protects against off-by-one bugs.
    return { status: 'empty' };
  }

  return {
    status: 'ready',
    image,
    hasNext: clampedIndex < images.length - 1,
    hasPrevious: clampedIndex > 0,
    goToNext,
    goToPrevious,
  };
}
