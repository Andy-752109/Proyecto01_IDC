import { useCallback, useEffect, useState } from 'react';
import { annotationSchema, annotationsListSchema } from './schemas';
import type { Annotation, DraftAnnotation } from './types';

const ANNOTATIONS_ENDPOINT = '/api/annotations';

type AnnotationChanges = Partial<Pick<Annotation, 'x' | 'y' | 'width' | 'height'>>;

type ActionOptions = { recordUndo?: boolean };

// Single-level undo: only the most recent reversible action is remembered
// (not a full history stack). Matches the SPEC-04 scenario, which only
// exercises "undo the last thing I did".
type LastAction =
  | { kind: 'create'; id: number }
  | { kind: 'update'; id: number; previous: AnnotationChanges }
  | { kind: 'delete'; annotation: Annotation };

type UseAnnotationsResult = {
  annotations: Annotation[];
  draft: DraftAnnotation | null;
  isSaving: boolean;
  isLoadingAnnotations: boolean;
  error: string | null;
  canUndo: boolean;
  startDraft: (box: DraftAnnotation) => void;
  cancelDraft: () => void;
  saveDraft: (categoryId: number) => Promise<boolean>;
  updateAnnotation: (
    id: number,
    changes: AnnotationChanges,
    options?: ActionOptions,
  ) => Promise<void>;
  deleteAnnotation: (id: number, options?: ActionOptions) => Promise<void>;
  undo: () => Promise<void>;
};

// Parses a fetch Response body as JSON and validates it against an
// annotation schema, instead of trusting the server with a raw cast
// (Ajuste #2: external responses get validated with Zod).
async function parseAnnotationResponse(response: Response): Promise<Annotation> {
  const data: unknown = await response.json();
  const result = annotationSchema.safeParse(data);
  if (!result.success) {
    throw new Error('La respuesta del servidor no tiene el formato esperado.');
  }
  return result.data;
}

// Manages annotations for a single image: the in-memory list, an in-progress
// "draft" box (drawn but not saved), the POST/PATCH/DELETE calls to
// /api/annotations, and a single-level undo of the last action.
export function useAnnotations(imageId: number): UseAnnotationsResult {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | undefined>(undefined);

  // SPEC-02 (reload): fetch whatever's already saved for this image instead
  // of always starting from an empty canvas. Runs whenever imageId changes
  // (including the very first time it becomes a real id).
  useEffect(() => {
    if (!imageId) {
      return;
    }
    let cancelled = false;
    setIsLoadingAnnotations(true);
    fetch(`${ANNOTATIONS_ENDPOINT}?imageId=${imageId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las anotaciones existentes.');
        }
        const data: unknown = await response.json();
        const parsed = annotationsListSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error('La respuesta de anotaciones no tiene el formato esperado.');
        }
        if (!cancelled) {
          setAnnotations(parsed.data);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Error desconocido al cargar anotaciones.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAnnotations(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  const startDraft = useCallback((box: DraftAnnotation) => {
    setDraft(box);
    setError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const saveDraft = useCallback(
    async (categoryId: number): Promise<boolean> => {
      if (!draft) {
        return false;
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
        const created = await parseAnnotationResponse(response);
        setAnnotations((previous) => [...previous, created]);
        setDraft(null);
        setLastAction({ kind: 'create', id: created.id });
        return true;
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : 'Error desconocido al guardar.',
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [draft, imageId],
  );

  const updateAnnotation = useCallback(
    async (id: number, changes: AnnotationChanges, options?: ActionOptions) => {
      const recordUndo = options?.recordUndo ?? true;
      setError(null);
      // Optimistic update so drag/resize feels instant; rolled back on failure.
      let previousSnapshot: Annotation[] = [];
      let previousValues: AnnotationChanges = {};
      setAnnotations((previous) => {
        previousSnapshot = previous;
        return previous.map((annotation) => {
          if (annotation.id !== id) {
            return annotation;
          }
          // Capture only the fields being changed, from their value *before*
          // this update — that's what undo needs to restore.
          previousValues = Object.fromEntries(
            (Object.keys(changes) as (keyof AnnotationChanges)[]).map((key) => [
              key,
              annotation[key],
            ]),
          );
          return { ...annotation, ...changes };
        });
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
        const updated = await parseAnnotationResponse(response);
        setAnnotations((previous) =>
          previous.map((annotation) => (annotation.id === id ? updated : annotation)),
        );
        if (recordUndo) {
          setLastAction({ kind: 'update', id, previous: previousValues });
        }
      } catch (caughtError) {
        setAnnotations(previousSnapshot);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Error desconocido al actualizar.',
        );
      }
    },
    [],
  );

  const deleteAnnotation = useCallback(async (id: number, options?: ActionOptions) => {
    const recordUndo = options?.recordUndo ?? true;
    setError(null);
    let previousSnapshot: Annotation[] = [];
    let deletedAnnotation: Annotation | undefined;
    setAnnotations((previous) => {
      previousSnapshot = previous;
      deletedAnnotation = previous.find((annotation) => annotation.id === id);
      return previous.filter((annotation) => annotation.id !== id);
    });
    try {
      const response = await fetch(`${ANNOTATIONS_ENDPOINT}/${id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        throw new Error('No se pudo borrar la caja.');
      }
      if (recordUndo && deletedAnnotation) {
        setLastAction({ kind: 'delete', annotation: deletedAnnotation });
      }
    } catch (caughtError) {
      setAnnotations(previousSnapshot);
      setError(caughtError instanceof Error ? caughtError.message : 'Error desconocido al borrar.');
    }
  }, []);

  const undo = useCallback(async () => {
    if (!lastAction) {
      return;
    }
    if (lastAction.kind === 'create') {
      // Undoing a creation just deletes it — passing recordUndo: false so
      // undo itself never becomes undoable (keeps this single-level).
      await deleteAnnotation(lastAction.id, { recordUndo: false });
    } else if (lastAction.kind === 'update') {
      await updateAnnotation(lastAction.id, lastAction.previous, { recordUndo: false });
    } else {
      // Undoing a deletion re-creates the box. The server assigns a new id
      // (there's no "undelete" endpoint) — position, category and image are
      // preserved, which is what the person actually cares about seeing back.
      try {
        const response = await fetch(ANNOTATIONS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId: lastAction.annotation.imageId,
            categoryId: lastAction.annotation.categoryId,
            x: lastAction.annotation.x,
            y: lastAction.annotation.y,
            width: lastAction.annotation.width,
            height: lastAction.annotation.height,
          }),
        });
        if (response.ok) {
          const restored = await parseAnnotationResponse(response);
          setAnnotations((previous) => [...previous, restored]);
        }
      } catch {
        // Best-effort: if this fails, the annotation stays deleted, but we
        // still clear lastAction below so the person isn't stuck in a
        // broken "undo" state.
      }
    }
    setLastAction(undefined);
  }, [lastAction, deleteAnnotation, updateAnnotation]);

  return {
    annotations,
    draft,
    isSaving,
    isLoadingAnnotations,
    error,
    canUndo: lastAction !== undefined,
    startDraft,
    cancelDraft,
    saveDraft,
    updateAnnotation,
    deleteAnnotation,
    undo,
  };
}
