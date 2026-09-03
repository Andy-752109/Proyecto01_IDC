import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageUploadPanel } from './ImageUploadPanel';

// SPEC-01 (features/image_upload.feature): feedback al usuario de éxito/error
// al subir una imagen.

const sampleImage = {
  id: 1,
  filename: 'cat.jpg',
  storageKey: 'images/1-cat.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 123,
  width: 10,
  height: 10,
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: '/api/images/1/file',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ImageUploadPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra el mensaje de éxito y la imagen en la lista tras un upload válido', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ images: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Image uploaded successfully', image: sampleImage }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ images: [sampleImage] }));

    render(<ImageUploadPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const file = new File(['contenido'], 'cat.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/subir imagen/i);
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('Image uploaded successfully');
    expect(await screen.findByText(/cat\.jpg/)).toBeInTheDocument();
  });

  it('muestra el mensaje de error cuando el backend rechaza el archivo', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ images: [] }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'Tipo de archivo no soportado. Formatos permitidos: JPG, JPEG, PNG' },
          400,
        ),
      );

    render(<ImageUploadPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const file = new File(['contenido'], 'doc.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/subir imagen/i);
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(/tipo de archivo no soportado/i);
  });
});
