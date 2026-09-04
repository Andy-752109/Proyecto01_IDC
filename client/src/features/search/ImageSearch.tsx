import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { Category } from '../annotations/schemas';
import { categoriesSchema } from '../annotations/schemas';
import './search.css';
import type { SearchFilters } from './useImageSearch';
import { useImageSearch } from './useImageSearch';

const STATUS_OPTIONS = ['pending', 'annotated', 'reviewed'] as const;

export function ImageSearch() {
  const { page, state, applyFilters, goToPage, pageSize } = useImageSearch();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const [statusValue, setStatusValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/categories')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudieron cargar las categorías.');
        }
        const data: unknown = await response.json();
        const parsed = categoriesSchema.safeParse(data);
        if (parsed.success && !cancelled) {
          setCategories(parsed.data);
        }
      })
      .catch(() => {
        // Non-fatal: the category chips just won't render. The rest of the
        // search (status/date filters) still works without them.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleCategory(name: string) {
    setSelectedCategoryNames((previous) =>
      previous.includes(name) ? previous.filter((item) => item !== name) : [...previous, name],
    );
  }

  function handleSearch() {
    const nextFilters: SearchFilters = {
      categories: selectedCategoryNames,
      status: statusValue,
      dateFrom,
      dateTo,
    };
    applyFilters(nextFilters);
  }

  function handleClear() {
    setSelectedCategoryNames([]);
    setStatusValue('');
    setDateFrom('');
    setDateTo('');
    applyFilters({ categories: [], status: '', dateFrom: '', dateTo: '' });
  }

  const totalPages = state.status === 'ready' ? Math.max(1, Math.ceil(state.total / pageSize)) : 1;

  return (
    <section className="image-search">
      <div className="image-search__filters">
        <div className="image-search__field">
          <span className="image-search__label">Categorías (deben estar todas presentes)</span>
          <div className="image-search__categories">
            {categories.length === 0 && (
              <span className="image-search__hint">Cargando categorías…</span>
            )}
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="image-search__category-chip"
                data-selected={selectedCategoryNames.includes(category.name)}
                style={{ '--category-color': category.color } as CSSProperties}
                onClick={() => toggleCategory(category.name)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="image-search__field">
          <label htmlFor="search-status">Estado</label>
          <select
            id="search-status"
            value={statusValue}
            onChange={(event) => setStatusValue(event.target.value)}
          >
            <option value="">Cualquiera</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="image-search__field">
          <label htmlFor="search-date-from">Desde</label>
          <input
            id="search-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="image-search__field">
          <label htmlFor="search-date-to">Hasta</label>
          <input
            id="search-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        <div className="image-search__actions">
          <button type="button" className="image-search__button--primary" onClick={handleSearch}>
            Buscar
          </button>
          <button type="button" onClick={handleClear}>
            Limpiar
          </button>
        </div>
      </div>

      {state.status === 'loading' && <p className="image-search__hint">Buscando…</p>}
      {state.status === 'error' && <p className="image-search__error">{state.message}</p>}

      {state.status === 'ready' && (
        <>
          <p className="image-search__count">
            {state.total} resultado{state.total === 1 ? '' : 's'}
          </p>

          <div className="image-search__results">
            {state.images.map((image) => (
              <figure key={image.id} className="image-search__result">
                <img src={image.url} alt={image.filename} />
                <figcaption>
                  <span className="image-search__filename">{image.filename}</span>
                  <span className="image-search__status">{image.status}</span>
                </figcaption>
              </figure>
            ))}
            {state.images.length === 0 && <p className="image-search__hint">Sin resultados.</p>}
          </div>

          {state.total > 0 && (
            <div className="image-search__pagination">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                ← Anterior
              </button>
              <span className="image-search__page-label">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
