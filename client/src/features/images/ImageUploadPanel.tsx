import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { type ApiImage, fetchImages, uploadImage } from '../../api/images';

type Feedback = { kind: 'success' | 'error'; message: string };

export function ImageUploadPanel() {
  const [images, setImages] = useState<ApiImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadImages = useCallback(async () => {
    try {
      setImages(await fetchImages());
    } catch (error) {
      setFeedback({ kind: 'error', message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsUploading(true);
    setFeedback(null);
    try {
      const image = await uploadImage(file);
      setFeedback({ kind: 'success', message: 'Image uploaded successfully' });
      setImages((current) => [image, ...current]);
    } catch (error) {
      setFeedback({ kind: 'error', message: (error as Error).message });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section>
      <h2>Imágenes</h2>
      <label>
        Subir imagen
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>

      {isUploading && <output>Subiendo...</output>}
      {feedback &&
        (feedback.kind === 'error' ? (
          <p role="alert">{feedback.message}</p>
        ) : (
          <output>{feedback.message}</output>
        ))}

      <ul>
        {images.map((image) => (
          <li key={image.id}>
            <img src={image.url} alt={image.filename} width={80} />
            <span>
              {image.filename} ({image.width}×{image.height})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
