import { AnnotationWorkspace } from './features/annotations/AnnotationWorkspace';
import { ImageUploadPanel } from './features/images/ImageUploadPanel';

// TODO(Ajuste #1, pendiente tras este merge): reemplazar el mock por la
// imagen real usando el contrato de T-04, ya mergeado a main.
const MOCK_IMAGE_ID = 1;
const MOCK_IMAGE_WIDTH = 800;
const MOCK_IMAGE_HEIGHT = 600;
const MOCK_IMAGE_URL =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23e5e5e5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23999999'%3EImagen mock \u2014 pendiente de conectar%3C/text%3E%3C/svg%3E";

export function App() {
  return (
    <main>
      <h1>Portal de Anotación de Imágenes</h1>
      <ImageUploadPanel />
      <AnnotationWorkspace
        imageId={MOCK_IMAGE_ID}
        imageUrl={MOCK_IMAGE_URL}
        imageWidth={MOCK_IMAGE_WIDTH}
        imageHeight={MOCK_IMAGE_HEIGHT}
      />
    </main>
  );
}
