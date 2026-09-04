# SPECs — Portal de Anotación de Imágenes (T-02)

Este documento traza cada regla de negocio relevante de la rúbrica a un SPEC
y a su archivo `.feature` correspondiente en Gherkin, cubriendo el punto
**8. SPECs, Gherkin y TDD (10 pts)** y sirviendo de base para las pruebas
de los puntos 4 (Portal de anotación), 5 (Dashboard y búsqueda) y 6 (Salida COCO).

## Decisión de idioma (documentado por feedback del PM)

Los `.feature` están escritos en **inglés** (Given/When/Then, Scenario Outline,
Examples), como convención técnica del equipo. Los textos orientados al
usuario dentro de los escenarios (mensajes de error, nombres de botones como
"Save and next") también quedan en inglés dentro del Gherkin, aunque el
copy real de la UI en producción puede estar en español — eso lo define
quien implemente la pantalla, no la especificación. `features/README.md`
no especifica idioma; esta sección deja la decisión explícita para que no
haya ambigüedad entre lo documentado y lo que hay en el repo.

## Trazabilidad regla de negocio → SPEC → .feature

| SPEC ID | Regla de negocio | Sección rúbrica | Archivo .feature | Tarea |
|---------|-------------------|------------------|-------------------|-------|
| SPEC-01 | Solo se aceptan imágenes de tipo y tamaño válidos, con feedback al usuario | 4. Portal de anotación | `image_upload.feature` | T-04 |
| SPEC-02 | Una caja (bounding box) se puede crear, mover, redimensionar y borrar, y persiste al recargar | 4. Portal de anotación | `bounding_box_create_edit.feature` | T-05 (excepto el escenario de reload, que es T-06) |
| SPEC-03 | Ninguna caja puede guardarse sin una categoría válida asignada | 4. Portal de anotación | `bounding_box_requires_category.feature` | T-05 |
| SPEC-04 | El usuario puede hacer zoom, deshacer, navegar entre imágenes y usar "guardar y siguiente", incluyendo qué pasa si hay cambios sin guardar al navegar | 4. Portal de anotación | `annotation_navigation.feature` | T-06 completo (issue #6: "persistir anotaciones + herramientas del anotador") |
| SPEC-05 | El dataset exportado es un JSON COCO válido con `images`, `annotations` y `categories`, con IDs consistentes entre secciones (7 pts) | 6. Salida COCO | `coco_export_structure.feature` | T-09 |
| SPEC-06 | El `bbox` se exporta como `[x, y, width, height]` en píxeles absolutos, con `area` coherente e `iscrowd` presente (3 pts) | 6. Salida COCO | `coco_bbox_format.feature` | T-09 |
| SPEC-07 | El dataset completo se puede descargar como archivo, sin excluir nada (2 pts) — separado de SPEC-06 porque en la rúbrica es un sub-punto distinto | 6. Salida COCO | `coco_full_export.feature` | T-09 |
| SPEC-08 | La búsqueda soporta el operador AND entre categorías, resuelta en SQL | 5. Dashboard y búsqueda | `search_operators.feature` | T-08 (Ale — reasignada por el PM el 2026-09-03, Esteban no había avanzado) |
| SPEC-09 | Los filtros por clase, estado y rango de fechas son combinables y los resultados se paginan correctamente | 5. Dashboard y búsqueda | `filters_and_pagination.feature` | T-08 (Ale — misma reasignación) |
| SPEC-10 | Las métricas del dashboard se calculan desde la BD; ninguna es un valor fijo | 5. Dashboard y búsqueda | `dashboard_metrics.feature` | T-07 (JuanPa) |

## División de trabajo confirmada por el PM (T-04/T-05/T-06/T-09)

- **T-04 (JuanPa)**: `/api/images` + MinIO. Cubre SPEC-01.
- **T-05 (Ale)**: `/api/categories` (solo GET, las 4 categorías vienen del seeder) y
  `/api/annotations` completo (`POST`, `PATCH /:id`, `DELETE /:id`) con validación Zod 4 —
  incluida la regla de SPEC-03 (rechazar caja sin categoría válida) y de coordenadas/dimensiones
  válidas. En el frontend: el canvas de Konva para crear, mover, redimensionar y borrar cajas.
  Cubre SPEC-02 (excepto reload) y SPEC-03. **No incluye zoom, undo, navegación ni "guardar y
  siguiente"** — eso es 100% T-06, aunque zoom/undo no dependan de un endpoint nuevo, para que
  toda la lógica de "canvas tools" viva en una sola tarea y T-05 no se infle.
- **T-06 (Ale)**: `GET /api/annotations?imageId=` (releer anotaciones al recargar la página) más
  **todo** `annotation_navigation.feature` (SPEC-04 completo: zoom, undo, guardar-y-siguiente,
  navegación entre imágenes). También agrega `PATCH /api/images/:id` (en `images.ts`, con
  autorización explícita del PM para tocar ese archivo de T-04) para marcar `pending → annotated`
  al usar "Guardar y siguiente" — bug bloqueante detectado en revisión de PR, corregido test-first
  (commit RED → commit GREEN).
- **T-09 (Esteban)**: `/api/export`, solo lectura. Cubre SPEC-05, SPEC-06 y SPEC-07.
- **T-07 (JuanPa)**: dashboard de métricas — `/api/dashboard/*`, solo lectura, todo resuelto con
  `COUNT`/`GROUP BY` en SQL vía Drizzle (nunca trayendo filas para contar en JS). Cubre SPEC-10,
  con su propio `dashboard_metrics.feature`.
- **T-08 (Ale, reasignada)**: `GET /api/images/search` — búsqueda con AND de categorías
  (SPEC-08) y filtros combinables de clase/estado/rango de fechas con paginación (SPEC-09).
  Endpoint nuevo y separado de `GET /api/images` (no se tocó ese, para no arriesgar nada de lo
  que ya dependía de él en T-05/T-06). En el frontend: pestaña "Buscar" con chips de categoría,
  filtro de estado, rango de fechas y resultados paginados.

## Detalle de implementación — T-08 (SPEC-08 + SPEC-09)

- **Endpoint**: `GET /api/images/search`, en `server/src/routes/images.ts`. Registrado
  **antes** de `GET /:id` (mismo tipo de bug de orden de rutas que ya se corrigió una vez en
  `annotations.ts` — si no, Express interpretaría `search` como un `:id`).
- **AND real en SQL**: se resuelve con `GROUP BY annotations.image_id` +
  `HAVING COUNT(DISTINCT categories.name) = N` (N = número de categorías pedidas) — una imagen
  solo califica si tiene anotaciones en **todas** las categorías solicitadas, no en cualquiera.
  Nada se filtra en JavaScript; el query hace todo el trabajo.
- **Filtros + paginación**: `status`, `dateFrom`/`dateTo` (contra `images.createdAt`) y
  `page`/`pageSize` se combinan con `AND` en el `WHERE`, con `LIMIT`/`OFFSET` para la página y
  una consulta `COUNT()` aparte (mismas condiciones) para el total — ambas 100% SQL.
- **Frontend**: `client/src/features/search/` (`ImageSearch.tsx`, `useImageSearch.ts`,
  `schemas.ts` con validación Zod de la respuesta, `search.css`). Pestaña nueva `"search"` en
  `App.tsx`, junto a las demás.
- **Aislamiento de datos de prueba**: los escenarios de Gherkin insertan imágenes **sintéticas**
  directo por Drizzle (prefijo `__t08_test_` en el filename) en vez de mutar imágenes reales
  sembradas — se limpian solas en el hook `After` de `features/support/hooks.ts`. La primera
  versión sí mutaba imágenes reales (status/createdAt) y esto contaminó el escenario de T-06
  "Save and move to the next image" en corridas posteriores; quedó corregido antes de mergear.

## Nota sobre `annotation_navigation.feature` en el checker de T-05

Como T-05 no trae `step-definitions/annotation_navigation.steps.ts`, al correr
`npm run test:bdd` esos escenarios van a salir como **undefined**, no como fallando en rojo —
es el comportamiento esperado mientras T-06 no exista. No se etiquetó `@wip` porque el archivo
completo pertenece a otra tarea, no es "trabajo pendiente dentro de T-05".

## Decisiones abiertas (pendientes de confirmar antes de implementar/TDD)

### ✅ Resuelto: alcance de los operadores de búsqueda (SPEC-08)

**Decisión del PM (2026-09-02):** solo se implementa **AND**. La rúbrica solo dio "car AND
person" como ejemplo; OR y NOT eran una asunción nuestra pendiente de confirmar, y se
descartaron para no rehacer trabajo más adelante sobre algo que el profesor no pidió.

### ✅ Resuelto: cómo se verifica "resuelto en SQL, no en memoria" (SPEC-08)

Implementado en `GET /api/images/search`: la coincidencia de categorías se calcula con
`GROUP BY` + `HAVING COUNT(DISTINCT ...)` directamente en la base de datos (ver "Detalle de
implementación" arriba), no con un `.filter()` en JavaScript sobre el resultado completo. Las
pruebas de Gherkin verifican el comportamiento observable (qué imágenes regresa la búsqueda),
no la query SQL en sí — que es justo lo que se había recomendado en la decisión original.

## Cómo usar esto para TDD (ciclo Red-Green-Refactor)

Para que el punto de "evidencia del ciclo TDD en los commits" se gane de
verdad (no se puede recuperar al final, según dijo el profe):

1. **Red**: escribir el step definition de un escenario del `.feature` y el
   test unitario/integración correspondiente, correrlo y que falle porque
   la lógica aún no existe. Commit: `test(SPEC-02): agrega prueba fallando para mover bounding box`
2. **Green**: implementar lo mínimo para que pase. Commit:
   `feat(SPEC-02): implementa mover bounding box`
3. **Refactor**: limpiar sin romper el test. Commit:
   `refactor(SPEC-02): extrae lógica de posición a helper`

Repetir por cada escenario. Así cada SPEC queda trazable en el historial de
commits, no solo en el código final.

## Notas para el equipo

- Cada escenario está escrito en Gherkin en inglés, usando Cucumber.js como
  corredor (ver decisión de idioma arriba).
- Los escenarios cubren específicamente las reglas que el profe marcó como
  evaluables por comportamiento (no solo por código), en particular la
  exportación COCO, que es donde más se pierden puntos si el JSON no
  corresponde exactamente al formato pedido.
