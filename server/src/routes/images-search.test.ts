import { describe, expect, it } from 'vitest';
import { buildCategoryMatchQuery } from './images';

// SPEC-08 (features/search_operators.feature): el AND de la búsqueda por
// categorías se resuelve en SQL, no filtrando en memoria. Esto se prueba
// inspeccionando el SQL que arma Drizzle (query.toSQL()) sin ejecutar nada
// contra la base de datos — es un test de la construcción de la query, no
// de integración, así que no necesita MariaDB corriendo.

describe('buildCategoryMatchQuery (SPEC-08): AND resuelto en SQL', () => {
  it('genera GROUP BY + HAVING COUNT(DISTINCT ...) en vez de traer filas y filtrar en JS', () => {
    const query = buildCategoryMatchQuery(['car', 'person']);
    const { sql } = query.toSQL();
    const normalized = sql.toLowerCase();

    expect(normalized).toContain('group by');
    expect(normalized).toContain('having');
    expect(normalized).toContain('count(distinct');
  });

  it('el número de categorías pedidas viaja como parámetro de la condición HAVING', () => {
    const categoryNames = ['car', 'person', 'dog'];
    const query = buildCategoryMatchQuery(categoryNames);
    const { params } = query.toSQL();

    // Los nombres van como parámetros del IN(...), y la cantidad de
    // categorías pedidas va como parámetro del "= N" en el HAVING — si
    // cambia la cantidad de categorías, cambia este parámetro, no un
    // valor hardcodeado en el código.
    expect(params).toEqual(expect.arrayContaining([...categoryNames, categoryNames.length]));
  });

  it('con una sola categoría, el HAVING exige exactamente 1 coincidencia (no "al menos una")', () => {
    const query = buildCategoryMatchQuery(['car']);
    const { params } = query.toSQL();

    expect(params.at(-1)).toBe(1);
  });
});
