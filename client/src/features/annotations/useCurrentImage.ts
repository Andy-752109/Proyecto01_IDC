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
      hasNextPending: boolean;
      goToNext: () => void;
      goToPrevious: () => void;
      goToNextPending: () => void;
    };

// Fetches the full image list once (ordered by createdAt desc, so index 0
// is the most recent — the same starting point as before navigation
// existed) and tracks which one is "current" by index. Plain sequential
// navigation ("Anterior"/"Siguiente") vs. jumping to the next PENDING image
// ("Guardar y siguiente") are both offered, since SPEC-04 needs both.
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

  const goToNextPending = useCallback(() => {
    setIndex((current) => {
      if (!images) {
        return current;
      }
      for (let i = current + 1; i < images.length; i += 1) {
        if (images[i]?.status === 'pending') {
          return i;
        }
      }
      // No pending image after this one — stay put rather than jump
      // somewhere unexpected. The button disables itself in this case.
      return current;
    });
  }, [images]);

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

  const hasNextPending = images.slice(clampedIndex + 1).some((item) => item.status === 'pending');

  return {
    status: 'ready',
    image,
    hasNext: clampedIndex < images.length - 1,
    hasPrevious: clampedIndex > 0,
    hasNextPending,
    goToNext,
    goToPrevious,
    goToNextPending,
  };
}
