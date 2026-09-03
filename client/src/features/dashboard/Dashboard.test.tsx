import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

// SPEC-10 (features/dashboard_metrics.feature): las métricas y gráficas del
// dashboard reflejan datos reales de la API, nunca valores fijos.

const summary = {
  totalImages: 10,
  annotatedImages: 3,
  totalBoundingBoxes: 15,
  totalCategories: 4,
};

const objectsByCategory = [
  { categoryId: 1, categoryName: 'car', color: '#e63946', objectCount: 7 },
  { categoryId: 2, categoryName: 'person', color: '#2a9d8f', objectCount: 5 },
  { categoryId: 3, categoryName: 'dog', color: '#f4a261', objectCount: 2 },
  { categoryId: 4, categoryName: 'bicycle', color: '#264653', objectCount: 1 },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra las métricas y el progreso reales que devuelve la API', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(summary))
      .mockResolvedValueOnce(jsonResponse({ objectsByCategory }));

    render(<Dashboard />);

    expect(await screen.findByTestId('metric-total-images')).toHaveTextContent('10');
    expect(screen.getByTestId('metric-annotated-images')).toHaveTextContent('3');
    expect(screen.getByTestId('metric-total-boxes')).toHaveTextContent('15');
    expect(screen.getByTestId('metric-total-categories')).toHaveTextContent('4');

    // Progreso: 3 de 10 (30%) — no un porcentaje fijo.
    expect(screen.getByText(/3 de 10/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('grafica objetos por categoría con los datos reales de la API', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(summary))
      .mockResolvedValueOnce(jsonResponse({ objectsByCategory }));

    render(<Dashboard />);

    await screen.findByTestId('metric-total-images');
    for (const category of objectsByCategory) {
      expect(screen.getByText(category.categoryName)).toBeInTheDocument();
    }
  });

  it('muestra un mensaje de error si la API falla', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    render(<Dashboard />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
