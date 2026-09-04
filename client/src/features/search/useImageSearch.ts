import { useCallback, useEffect, useState } from 'react';
import type { ImageMetadata } from '../annotations/schemas';
import { searchResponseSchema } from './schemas';

export type SearchFilters = {
  categories: string[]; // category names — AND semantics, resolved server-side
  status: string; // '' means "any"
  dateFrom: string; // yyyy-mm-dd, '' means unset
  dateTo: string;
};

export const DEFAULT_FILTERS: SearchFilters = {
  categories: [],
  status: '',
  dateFrom: '',
  dateTo: '',
};

const PAGE_SIZE = 12;

type SearchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; images: ImageMetadata[]; total: number };

export function useImageSearch() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<SearchState>({ status: 'loading' });

  const runSearch = useCallback(async (activeFilters: SearchFilters, activePage: number) => {
    setState({ status: 'loading' });

    const params = new URLSearchParams();
    if (activeFilters.categories.length > 0) {
      params.set('categories', activeFilters.categories.join(','));
    }
    if (activeFilters.status) {
      params.set('status', activeFilters.status);
    }
    if (activeFilters.dateFrom) {
      params.set('dateFrom', activeFilters.dateFrom);
    }
    if (activeFilters.dateTo) {
      params.set('dateTo', activeFilters.dateTo);
    }
    params.set('page', String(activePage));
    params.set('pageSize', String(PAGE_SIZE));

    try {
      const response = await fetch(`/api/images/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('No se pudo completar la búsqueda.');
      }
      const data: unknown = await response.json();
      const parsed = searchResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('La respuesta de búsqueda no tiene el formato esperado.');
      }
      setState({ status: 'ready', images: parsed.data.images, total: parsed.data.total });
    } catch (caughtError) {
      setState({
        status: 'error',
        message: caughtError instanceof Error ? caughtError.message : 'Error desconocido.',
      });
    }
  }, []);

  const applyFilters = useCallback(
    (nextFilters: SearchFilters) => {
      setFilters(nextFilters);
      setPage(1);
      runSearch(nextFilters, 1);
    },
    [runSearch],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      runSearch(filters, nextPage);
    },
    [filters, runSearch],
  );

  // Load once on mount with no filters, so the tab isn't blank on first view.
  useEffect(() => {
    runSearch(DEFAULT_FILTERS, 1);
  }, [runSearch]);

  return { page, state, applyFilters, goToPage, pageSize: PAGE_SIZE };
}
