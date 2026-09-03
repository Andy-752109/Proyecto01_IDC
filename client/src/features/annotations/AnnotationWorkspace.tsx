import { useCallback, useEffect, useState } from 'react';
import './annotations.css';
import { AnnotationCanvas } from './AnnotationCanvas';
import { CategoryPicker } from './CategoryPicker';
import { categoriesSchema } from './schemas';
import type { Category, DraftAnnotation } from './types';
import { useAnnotations } from './useAnnotations';
import { useCurrentImage } from './useCurrentImage';

type PendingNavigation = 'next' | 'previous' | null;

export function AnnotationWorkspace() {
  const currentImage = useCurrentImage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Set when the person tries to navigate away while a draft box (drawn but
  // not saved) exists — SPEC-04's "unsaved changes" scenarios. Holds which
  // direction they were trying to go, so we can complete it after they
  // choose to save or discard.
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);

  // imageId only really exists once currentImage is 'ready' — useAnnotations
  // still needs a stable number, so we fall back to 0 (never actually used:
  // the canvas and its POST/PATCH/DELETE calls only render once ready).
  const imageId = currentImage.status === 'ready' ? currentImage.image.id : 0;
  const {
    annotations,
    draft,
    isSaving,
    isLoadingAnnotations,
    error,
    canUndo,
    startDraft,
    cancelDraft,
    saveDraft,
    updateAnnotation,
    deleteAnnotation,
    undo,
  } = useAnnotations(imageId);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/categories')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las categorías.');
        }
        const data: unknown = await response.json();
        // Ajuste #2: validar con Zod en vez de confiar en un cast directo.
        const result = categoriesSchema.safeParse(data);
        if (!result.success) {
          throw new Error('La respuesta de categorías no tiene el formato esperado.');
        }
        if (!cancelled) {
          setCategories(result.data);
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

  // Delete/Backspace removes the selected box; Ctrl+Z / Cmd+Z undoes the
  // last action — unless the person is typing somewhere else on the page.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedId !== null &&
        !isTyping
      ) {
        deleteAnnotation(selectedId);
        setSelectedId(null);
        return;
      }

      if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !isTyping) {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteAnnotation, undo]);

  const handleDrawEnd = useCallback(
    (box: DraftAnnotation) => {
      startDraft(box);
      setPendingCategoryId(null);
      setSelectedId(null);
      setSavedMessage(null);
    },
    [startDraft],
  );

  async function handleSaveDraft() {
    if (pendingCategoryId === null) {
      return;
    }
    const succeeded = await saveDraft(pendingCategoryId);
    setPendingCategoryId(null);
    if (succeeded) {
      setSavedMessage('Caja guardada.');
      window.setTimeout(() => setSavedMessage(null), 2500);
    }
  }

  function handleDeleteSelected() {
    if (selectedId === null) {
      return;
    }
    deleteAnnotation(selectedId);
    setSelectedId(null);
  }

  // Actually switches images and clears per-image local state. Only called
  // once we're sure there's nothing unsaved left behind (or the person
  // explicitly chose to discard it).
  function completeNavigation(direction: 'next' | 'previous') {
    if (currentImage.status !== 'ready') {
      return;
    }
    setSelectedId(null);
    setPendingCategoryId(null);
    setSavedMessage(null);
    setPendingNavigation(null);
    if (direction === 'next') {
      currentImage.goToNext();
    } else {
      currentImage.goToPrevious();
    }
  }

  function handleNavigate(direction: 'next' | 'previous') {
    if (currentImage.status !== 'ready') {
      return;
    }
    // SPEC-04: navigating away with an unsaved draft box prompts first,
    // instead of silently discarding it.
    if (draft) {
      setPendingNavigation(direction);
      return;
    }
    completeNavigation(direction);
  }

  async function handleConfirmSaveAndNavigate() {
    if (pendingCategoryId === null || !pendingNavigation) {
      return;
    }
    const succeeded = await saveDraft(pendingCategoryId);
    if (succeeded) {
      completeNavigation(pendingNavigation);
    }
  }

  function handleDiscardAndNavigate() {
    if (!pendingNavigation) {
      return;
    }
    cancelDraft();
    completeNavigation(pendingNavigation);
  }

  function handleCancelNavigation() {
    setPendingNavigation(null);
  }

  // "Guardar y siguiente": save any pending draft (if a category was
  // chosen), then jump to the next PENDING image — not just the next one
  // in the list, which is what plain "Siguiente" does.
  async function handleSaveAndNext() {
    if (currentImage.status !== 'ready') {
      return;
    }
    if (draft) {
      if (pendingCategoryId === null) {
        return;
      }
      const succeeded = await saveDraft(pendingCategoryId);
      if (!succeeded) {
        return;
      }
    }
    // Team decision: "Guardar y siguiente" marks the image
    // pending -> annotated, so the dashboard's "imágenes anotadas" metric
    // reflects real progress. Best-effort: if this fails, don't block
    // navigation — the boxes are already safely saved either way.
    try {
      const response = await fetch(`/api/images/${currentImage.image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'annotated' }),
      });
      if (response.ok) {
        currentImage.markCurrentAsAnnotated();
      }
    } catch {
      // Swallowed on purpose — see comment above.
    }
    setSelectedId(null);
    setPendingCategoryId(null);
    setSavedMessage(null);
    setPendingNavigation(null);
    currentImage.goToNextPending();
  }

  if (currentImage.status === 'loading') {
    return <p className="annotation-workspace__hint">Cargando imagen…</p>;
  }

  if (currentImage.status === 'error') {
    return <p className="annotation-workspace__error">{currentImage.message}</p>;
  }

  if (currentImage.status === 'empty') {
    return (
      <p className="annotation-workspace__hint">
        No hay imágenes cargadas todavía. Sube una para empezar a anotar.
      </p>
    );
  }

  const { image, hasNext, hasPrevious, hasNextPending } = currentImage;

  return (
    <div className="annotation-workspace">
      <div className="annotation-workspace__main">
        <div className="annotation-workspace__nav">
          <button type="button" onClick={() => handleNavigate('previous')} disabled={!hasPrevious}>
            ← Anterior
          </button>
          <span className="annotation-workspace__nav-label">{image.filename}</span>
          <button type="button" onClick={() => handleNavigate('next')} disabled={!hasNext}>
            Siguiente →
          </button>
          <button
            type="button"
            className="annotation-workspace__save-next"
            onClick={handleSaveAndNext}
            disabled={(draft !== null && pendingCategoryId === null) || !hasNextPending || isSaving}
          >
            {isSaving ? 'Guardando…' : 'Guardar y siguiente'}
          </button>
        </div>

        <AnnotationCanvas
          imageUrl={image.url}
          imageWidth={image.width}
          imageHeight={image.height}
          annotations={annotations}
          categories={categories}
          draft={draft}
          selectedId={selectedId}
          onDrawEnd={handleDrawEnd}
          onSelect={setSelectedId}
          onChange={updateAnnotation}
        />
      </div>

      <aside className="annotation-workspace__sidebar">
        <button
          type="button"
          className="annotation-workspace__undo"
          onClick={() => undo()}
          disabled={!canUndo}
        >
          Deshacer (Ctrl+Z)
        </button>

        {isLoadingAnnotations && (
          <p className="annotation-workspace__hint">Cargando anotaciones existentes…</p>
        )}
        {categoriesError && <p className="annotation-workspace__error">{categoriesError}</p>}
        {error && <p className="annotation-workspace__error">{error}</p>}
        {savedMessage && <p className="annotation-workspace__success">{savedMessage}</p>}

        {pendingNavigation && (
          <div className="annotation-workspace__panel annotation-workspace__panel--warning">
            <p>Tienes una caja sin guardar. ¿Qué quieres hacer antes de cambiar de imagen?</p>
            <div className="annotation-workspace__actions">
              {pendingCategoryId !== null && (
                <button
                  type="button"
                  className="annotation-workspace__button--primary"
                  onClick={handleConfirmSaveAndNavigate}
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando…' : 'Guardar y continuar'}
                </button>
              )}
              <button type="button" onClick={handleDiscardAndNavigate} disabled={isSaving}>
                Descartar y continuar
              </button>
              <button type="button" onClick={handleCancelNavigation} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {draft && !pendingNavigation && (
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
                className="annotation-workspace__button--primary"
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

        {!draft && selectedId === null && !pendingNavigation && (
          <p className="annotation-workspace__hint">
            Dibuja una caja sobre la imagen para empezar a anotar.
          </p>
        )}
      </aside>
    </div>
  );
}
