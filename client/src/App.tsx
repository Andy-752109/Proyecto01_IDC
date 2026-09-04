import { useState } from 'react';
import { AnnotationWorkspace } from './features/annotations/AnnotationWorkspace';
import { Dashboard } from './features/dashboard/Dashboard';
import { ExportCocoButton } from './features/export/ExportCocoButton';
import { ImageUploadPanel } from './features/images/ImageUploadPanel';
import { ImageSearch } from './features/search/ImageSearch';
type View = 'images' | 'annotate' | 'dashboard' | 'search' | 'coco';

export function App() {
  const [view, setView] = useState<View>('images');

  return (
    <main>
      <h1>Portal de Anotación de Imágenes</h1>
      <nav>
        <button type="button" onClick={() => setView('images')} disabled={view === 'images'}>
          Imágenes
        </button>
        <button type="button" onClick={() => setView('annotate')} disabled={view === 'annotate'}>
          Anotar
        </button>
        <button type="button" onClick={() => setView('dashboard')} disabled={view === 'dashboard'}>
          Dashboard
        </button>
        <button type="button" onClick={() => setView('search')} disabled={view === 'search'}>
          Buscar
        </button>
        <button type="button" onClick={() => setView('coco')} disabled={view === 'coco'}>
          COCO
        </button>
      </nav>
      {view === 'images' && <ImageUploadPanel />}
      {view === 'annotate' && <AnnotationWorkspace />}
      {view === 'dashboard' && <Dashboard />}
      {view === 'search' && <ImageSearch />}
      {view === 'dashboard' && <ExportCocoButton />}
    </main>
  );
}
