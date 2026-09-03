import { useEffect, useState } from 'react';
import { imagesListResponseSchema } from './schemas';
import type { ImageMetadata } from './schemas';

type UseCurrentImageResult =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; image: ImageMetadata };

// There's no "pick which image to annotate" UI yet (that's navigation,
// deferred to T-06) — for now we just annotate the most recently uploaded
// image. GET /api/images already returns them ordered by createdAt desc, so
// that's simply the first item. The response is validated with Zod instead
// of trusted with a cast (Ajuste #2).
export function useCurrentImage(): UseCurrentImageResult {
  const [result, setResult] = useState<UseCurrentImageResult>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setResult({ status: 'loading' });

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
        if (cancelled) {
          return;
        }
        const mostRecent = parsed.data.images[0];
        if (!mostRecent) {
          setResult({ status: 'empty' });
          return;
        }
        setResult({ status: 'ready', image: mostRecent });
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setResult({
            status: 'error',
            message: caughtError instanceof Error ? caughtError.message : 'Error desconocido.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
