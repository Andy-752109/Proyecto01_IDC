import { AnnotationWorkspace } from './features/annotations/AnnotationWorkspace';
import { ExportCocoButton } from './features/export/ExportCocoButton';
import { ImageUploadPanel } from './features/images/ImageUploadPanel';
import { useState } from 'react';
import { Dashboard } from './features/dashboard/Dashboard';
type View = 'images' | 'annotate' | 'dashboard';

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
      </nav>
      {view === 'images' && <ImageUploadPanel />}
      {view === 'annotate' && <AnnotationWorkspace />}
      {view === 'dashboard' && <Dashboard />}
    </main>
  );
}