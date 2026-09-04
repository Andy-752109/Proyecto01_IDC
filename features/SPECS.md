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

## División final de tareas (confirmada por el PM)

> Esta sección reemplaza a una versión anterior ("División de trabajo
> confirmada por el PM (T-04/T-05/T-06/T-09)") que quedó obsoleta una vez
> que T-06/T-07/T-08/T-09 se asignaron y algunas fronteras cambiaron
> (p. ej. `GET /api/annotations?imageId=` terminó siendo parte de T-05, no
> de T-06). Se eliminó esa versión en la auditoría de T-10 para no dejar
> dos fuentes de verdad contradictorias en el mismo documento.

- **T-04 (JuanPa)**: `/api/images` + MinIO. Cubre SPEC-01.
- **T-05 (Ale)**: anotador — crear, seleccionar, mover, redimensionar y eliminar bounding boxes;
  categorías, colores y validación de categoría (SPEC-02 salvo reload, SPEC-03).
- **T-06 (Ale)**: reload/persistencia al recargar + zoom, undo, navegación y guardar/siguiente
  (el escenario `@wip` de SPEC-02, y SPEC-04 completo). También agrega
  `PATCH /api/images/:id` (en `images.ts`, con autorización explícita del PM para tocar ese
  archivo de T-04) para marcar `pending → annotated` al usar "Guardar y siguiente" — bug
  bloqueante detectado en revisión de PR, corregido test-first (commit RED → commit GREEN).
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

## Auditoría de integración (T-10, 2026-09-03)

Estado tras integrar T-04, T-05, T-06, T-07 y T-09 en `main` (T-08 —
búsqueda/filtros — sigue sin mergear; ver más abajo).

**Integración end-to-end (verificado manualmente contra el servidor real):**
carga de imagen → anotación (bounding box + categoría) → persiste al
recargar (`GET /api/annotations?imageId=`) → "guardar y siguiente" marca la
imagen como `annotated` → el dashboard refleja el cambio en tiempo real
(`totalImages`, `annotatedImages`, `totalBoundingBoxes`, objetos por
categoría) → la exportación COCO incluye la imagen y la anotación con
`bbox`/`area`/`iscrowd` correctos. Ningún módulo crítico quedó aislado.

**Bugs de integración encontrados y corregidos en esta auditoría:**
1. En `App.tsx`, el botón de exportar COCO estaba condicionado a
   `view === 'dashboard'` en vez de `view === 'coco'` (copy-paste al
   agregar la pestaña) — la pestaña "COCO" no mostraba nada, y el botón
   aparecía escondido dentro del Dashboard. Corregido.
2. `features/step-definitions/coco_export.steps.ts` crea una categoría de
   prueba (`__coco-export-test-category`) con upsert, pero su `After` nunca
   la borraba — quedaba contaminando la tabla real de `categories` para
   siempre después de correr `npm run test:bdd` una sola vez: aparecía en
   `/api/categories`, en el selector de categorías del anotador, en el
   dashboard, y hasta en el JSON exportado. Corregido: el `After` ahora
   también borra la categoría de prueba.

**Trazabilidad (Regla → SPEC → .feature → prueba):** verificada contra la
tabla de arriba. SPEC-01 a SPEC-07 y SPEC-10 tienen `.feature` y step
definitions reales (no placeholders) que corren con `npm run test:bdd`.
SPEC-08 y SPEC-09 (T-08) todavía no al momento de esta primera pasada —
la rama `feature/t08-busqueda-filtros` existía pero no estaba mergeada;
sus escenarios salían como **undefined**, no en rojo, que era el estado
esperado mientras T-08 no aterrizara. (Ver la segunda pasada más abajo:
T-08 ya se integró y esto quedó resuelto.)

**Evidencia TDD (Red→Green→Refactor) — revisada en el historial de git:**
- SPEC-01 (T-04) y SPEC-10 (T-07): commits `test(...)` → `feat(...)`
  claros, referenciando la SPEC, con el Red verificado en su momento.
- SPEC-02/03 (T-05): `564bd53 test(SPEC-02,SPEC-03): ... (RED)` →
  `c25526c feat(SPEC-02,SPEC-03): ... (GREEN)` — evidencia limpia.
- SPEC-04 (T-06): el grueso de la funcionalidad (zoom, undo, navegación,
  aviso de cambios sin guardar) se implementó como una serie de commits
  `feat(SPEC-04): ...` sin un commit Red explícito inmediatamente antes de
  cada uno — no cumple estrictamente "el Red ocurre antes del Green" para
  esa parte. Sí hay un ciclo Red→Green real y bien documentado para un bug
  puntual reportado por el PM: `50832f9 test(SPEC-04): ... en rojo (RED) —
  bug reportado por PM` → `bb2109c fix(SPEC-04): ... (GREEN)`.
- SPEC-05/06/07 (T-09): la lógica de exportación (`coco.service.ts`) sí
  tiene un ciclo limpio: `d00a6a9 test(export): ... (RED)` →
  `8beb3c9 feat(export): ... (GREEN)`. La integración de esa lógica al
  resto de la app (botón en `App.tsx`, montar el router) pasó por varios
  commits sin prefijo convencional ni referencia a SPEC ni etiqueta
  Red/Green (`wip`, `reparacion nombre y trade-off`, `Correccion (ERROR,
  se sobreescribieron cambios)`, `Falto agregar boton COCO`) — funcionan
  (los tests pasan), pero no dejan evidencia TDD legible ahí.

No se reescribió el historial de nadie para "arreglar" estos huecos — la
rúbrica es explícita en que la evidencia TDD no se puede reconstruir
artificialmente al final, así que esto queda documentado como hallazgo,
no corregido retroactivamente.

**Prueba de que las pruebas prueban algo real (mutation spot-check):**
se rompió a propósito el límite de tamaño de subida (SPEC-01) y el cálculo
de `area` en la exportación COCO (SPEC-06), y en ambos casos la prueba
correspondiente falló de inmediato; se revirtió después. Confirma que no
son pruebas "de teatro".

**Git/PR:** todo commit en `main` llega vía un merge commit de PR (`git log
main --first-parent` solo muestra "Merge pull request #N" y el setup
inicial) — cero pushes directos a `main`. Sin conflictos pendientes.
`main` queda estable después de esta auditoría: `npm run typecheck`,
`npm run check` (Biome), `npm test` y `npm run test:bdd` en verde.

### Segunda pasada (2026-09-04): T-08 ya mergeado

T-08 (PR #22, reasignada a Ale) aterrizó en `main` mientras esta auditoría
seguía abierta. Se repitió la verificación completa con T-08 incluido:

- `npm run test:bdd`: **31/31 escenarios, 0 undefined, 0 fallos** — SPEC-08
  y SPEC-09 ya tienen step definitions reales y quedan cubiertas.
- Búsqueda (`GET /api/images/search`) resuelta 100% en SQL: `GROUP BY` +
  `HAVING COUNT(DISTINCT categories.name) = N` para el AND de SPEC-08 (una
  imagen solo califica si tiene anotaciones en *todas* las categorías
  pedidas), `WHERE` combinable con `status`/`dateFrom`/`dateTo`, y
  `LIMIT`/`OFFSET` + `COUNT()` aparte para la paginación de SPEC-09. Nada
  se filtra en JavaScript. Verificado también end-to-end contra el
  servidor real.
- Los dos bugs de integración de esta auditoría (botón COCO, categoría de
  prueba sin limpiar) seguían presentes en el `main` con T-08 ya
  integrado — se confirmaron otra vez y el fix se rebaseó sobre esta
  versión sin cambios de fondo, solo resolviendo el conflicto esperado en
  `App.tsx` (T-08 agregó su propia pestaña "Buscar" en el mismo archivo).
- `npm run typecheck`, `npm run check` y `npm test` (33/33) siguen en
  verde con T-08 integrado.

Con esto, **las 6 tareas de implementación (T-04 a T-09) están integradas
en `main`** y las 10 SPECs tienen trazabilidad completa a `.feature` y
step definitions reales.
