import { useCallback, useState } from 'react';
import type { Annotation, DraftAnnotation } from './types';

const ANNOTATIONS_ENDPOINT = '/api/annotations';

type AnnotationChanges = Partial<Pick<Annotation, 'x' | 'y' | 'width' | 'height'>>;

type UseAnnotationsResult = {
  annotations: Annotation[];
  draft: DraftAnnotation | null;
  isSaving: boolean;
  error: string | null;
  startDraft: (box: DraftAnnotation) => void;
  cancelDraft: () => void;
  saveDraft: (categoryId: number) => Promise<void>;
  updateAnnotation: (id: number, changes: AnnotationChanges) => Promise<void>;
  deleteAnnotation: (id: number) => Promise<void>;
};

// Manages annotations for a single image: the in-memory list, an in-progress
// "draft" box (drawn but not saved), and the POST/PATCH/DELETE calls to
// /api/annotations. Doesn't fetch existing annotations on mount — that's
// GET /api/annotations?imageId=, deferred to T-06 (@wip in the .feature).
export function useAnnotations(imageId: number): UseAnnotationsResult {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDraft = useCallback((box: DraftAnnotation) => {
    setDraft(box);
    setError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const saveDraft = useCallback(
    async (categoryId: number) => {
      if (!draft) {
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        const response = await fetch(ANNOTATIONS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId, categoryId, ...draft }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'No se pudo guardar la caja.');
        }
        const created = (await response.json()) as Annotation;
        setAnnotations((previous) => [...previous, created]);
        setDraft(null);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : 'Error desconocido al guardar.',
        );
      } finally {
        setIsSaving(false);
      }
    },
    [draft, imageId],
  );

  const updateAnnotation = useCallback(async (id: number, changes: AnnotationChanges) => {
    setError(null);
    // Optimistic update so drag/resize feels instant; rolled back on failure.
    let previousSnapshot: Annotation[] = [];
    setAnnotations((previous) => {
      previousSnapshot = previous;
      return previous.map((annotation) =>
        annotation.id === id ? { ...annotation, ...changes } : annotation,
      );
    });
    try {
      const response = await fetch(`${ANNOTATIONS_ENDPOINT}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        throw new Error('No se pudo actualizar la caja.');
      }
      const updated = (await response.json()) as Annotation;
      setAnnotations((previous) =>
        previous.map((annotation) => (annotation.id === id ? updated : annotation)),
      );
    } catch (caughtError) {
      setAnnotations(previousSnapshot);
      setError(
        caughtError instanceof Error ? caughtError.message : 'Error desconocido al actualizar.',
      );
    }
  }, []);

  const deleteAnnotation = useCallback(async (id: number) => {
    setError(null);
    let previousSnapshot: Annotation[] = [];
    setAnnotations((previous) => {
      previousSnapshot = previous;
      return previous.filter((annotation) => annotation.id !== id);
    });
    try {
      const response = await fetch(`${ANNOTATIONS_ENDPOINT}/${id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        throw new Error('No se pudo borrar la caja.');
      }
    } catch (caughtError) {
      setAnnotations(previousSnapshot);
      setError(caughtError instanceof Error ? caughtError.message : 'Error desconocido al borrar.');
    }
  }, []);

  return {
    annotations,
    draft,
    isSaving,
    error,
    startDraft,
    cancelDraft,
    saveDraft,
    updateAnnotation,
    deleteAnnotation,
  };
}
