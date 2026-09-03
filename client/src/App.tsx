import { AnnotationWorkspace } from './features/annotations/AnnotationWorkspace';
import { ExportCocoButton } from './features/export/ExportCocoButton';
import { ImageUploadPanel } from './features/images/ImageUploadPanel';

export function App() {
  return (
    <main>
      <h1>Portal de Anotación de Imágenes</h1>
      <ImageUploadPanel />
      <AnnotationWorkspace />
      <ExportCocoButton />
    </main>
  );
}
