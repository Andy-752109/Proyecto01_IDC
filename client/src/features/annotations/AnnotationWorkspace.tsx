import { useCallback, useEffect, useState } from 'react';
import './annotations.css';
import { AnnotationCanvas } from './AnnotationCanvas';
import { CategoryPicker } from './CategoryPicker';
import type { Category, DraftAnnotation } from './types';
import { useAnnotations } from './useAnnotations';

type AnnotationWorkspaceProps = {
  imageId: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
};

export function AnnotationWorkspace({
  imageId,
  imageUrl,
  imageWidth,
  imageHeight,
}: AnnotationWorkspaceProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);

  const {
    annotations,
    draft,
    isSaving,
    error,
    startDraft,
    cancelDraft,
    saveDraft,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations(imageId);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/categories')
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las categorías.');
        }
        return response.json() as Promise<Category[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setCategories(data);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setCategoriesError(
            caughtError instanceof Error ? caughtError.message : 'Error desconocido.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Delete/Backspace removes the selected box, unless the person is typing
  // somewhere else on the page (e.g. a future search box).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }
      if (selectedId === null) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      deleteAnnotation(selectedId);
      setSelectedId(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteAnnotation]);

  const handleDrawEnd = useCallback(
    (box: DraftAnnotation) => {
      startDraft(box);
      setPendingCategoryId(null);
      setSelectedId(null);
    },
    [startDraft],
  );

  async function handleSaveDraft() {
    if (pendingCategoryId === null) {
      return;
    }
    await saveDraft(pendingCategoryId);
    setPendingCategoryId(null);
  }

  function handleDeleteSelected() {
    if (selectedId === null) {
      return;
    }
    deleteAnnotation(selectedId);
    setSelectedId(null);
  }

  return (
    <div className="annotation-workspace">
      <AnnotationCanvas
        imageUrl={imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        annotations={annotations}
        categories={categories}
        draft={draft}
        selectedId={selectedId}
        onDrawEnd={handleDrawEnd}
        onSelect={setSelectedId}
        onChange={updateAnnotation}
      />

      <aside className="annotation-workspace__sidebar">
        {categoriesError && <p className="annotation-workspace__error">{categoriesError}</p>}
        {error && <p className="annotation-workspace__error">{error}</p>}

        {draft && (
          <div className="annotation-workspace__panel">
            <p>Nueva caja dibujada. Asigná una clase válida para guardarla.</p>
            <CategoryPicker
              categories={categories}
              selectedCategoryId={pendingCategoryId}
              onSelect={setPendingCategoryId}
            />
            <div className="annotation-workspace__actions">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={pendingCategoryId === null || isSaving}
              >
                {isSaving ? 'Guardando…' : 'Guardar caja'}
              </button>
              <button type="button" onClick={cancelDraft} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {selectedId !== null && !draft && (
          <div className="annotation-workspace__panel">
            <p>Caja seleccionada. Arrastrala o redimensionala en el lienzo, o borrala con Supr.</p>
            <div className="annotation-workspace__actions">
              <button type="button" onClick={handleDeleteSelected}>
                Borrar caja
              </button>
            </div>
          </div>
        )}

        {!draft && selectedId === null && (
          <p className="annotation-workspace__hint">
            Dibuja una caja sobre la imagen para empezar a anotar.
          </p>
        )}
      </aside>
    </div>
  );
}
