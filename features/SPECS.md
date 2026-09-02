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
| SPEC-02 | Una caja (bounding box) se puede crear, mover, redimensionar y borrar, y persiste al recargar | 4. Portal de anotación | `bounding_box_create_edit.feature` | T-05 (excepto el escenario `@wip` de reload, que es T-06) |
| SPEC-03 | Ninguna caja puede guardarse sin una categoría válida asignada | 4. Portal de anotación | `bounding_box_requires_category.feature` | T-05 |
| SPEC-04 | El usuario puede hacer zoom, deshacer, navegar entre imágenes y usar "guardar y siguiente" | 4. Portal de anotación | `annotation_navigation.feature` | T-06 completo (issue #6: "persistir anotaciones + herramientas del anotador") |
| SPEC-05 | El dataset exportado es un JSON COCO válido con `images`, `annotations` y `categories`, con IDs consistentes entre secciones (7 pts) | 6. Salida COCO | `coco_export_structure.feature` | T-09 |
| SPEC-06 | El `bbox` se exporta como `[x, y, width, height]` en píxeles absolutos, con `area` coherente e `iscrowd` presente (3 pts) | 6. Salida COCO | `coco_bbox_format.feature` | T-09 |
| SPEC-07 | El dataset completo se puede descargar como archivo, sin excluir nada (2 pts) — separado de SPEC-06 porque en la rúbrica es un sub-punto distinto | 6. Salida COCO | `coco_full_export.feature` | T-09 |
| SPEC-08 | La búsqueda soporta operadores booleanos entre categorías (ver "Decisiones abiertas" — alcance aún no confirmado) | 5. Dashboard y búsqueda | `search_operators.feature` | Sin asignar todavía |
| SPEC-09 | Los filtros por clase, estado y rango de fechas son combinables y los resultados se paginan correctamente | 5. Dashboard y búsqueda | `filters_and_pagination.feature` | Sin asignar todavía |

## División de trabajo confirmada por el PM (T-04/T-05/T-06/T-09)

- **T-04 (JuanPa)**: `/api/images` + MinIO. Cubre SPEC-01.
- **T-05 (Ale, este documento)**: `/api/categories` (solo GET, las 4 categorías vienen del seeder) y
  `/api/annotations` completo (`POST`, `PATCH /:id`, `DELETE /:id`) con validación Zod 4 —
  incluida la regla de SPEC-03 (rechazar caja sin categoría válida) y de coordenadas/dimensiones
  válidas. En el frontend: el canvas de Konva para crear, mover, redimensionar y borrar cajas.
  Cubre SPEC-02 (excepto reload) y SPEC-03. **No incluye zoom, undo, navegación ni "guardar y
  siguiente"** — eso es 100% T-06, aunque zoom/undo no dependan de un endpoint nuevo, para que
  toda la lógica de "canvas tools" viva en una sola tarea y T-05 no se infle.
- **T-06 (sin asignar todavía, issue #6: "persistir anotaciones + herramientas del anotador")**:
  `GET /api/images/:id/annotations` (releer anotaciones al recargar la página) — el escenario
  `@wip` dentro de `bounding_box_create_edit.feature` — más **todo** `annotation_navigation.feature`
  (SPEC-04 completo: zoom, undo, guardar-y-siguiente, navegación entre imágenes). T-06 es quien
  crea `step-definitions/annotation_navigation.steps.ts`; T-05 no lo incluye.
- **T-09 (Esteban)**: `/api/export`, solo lectura. Cubre SPEC-05, SPEC-06 y SPEC-07.

## Nota sobre `annotation_navigation.feature` en el checker de T-05

Como T-05 no trae `step-definitions/annotation_navigation.steps.ts`, al correr
`npm run test:bdd` esos escenarios van a salir como **undefined**, no como fallando en rojo —
es el comportamiento esperado mientras T-06 no exista. No se etiquetó `@wip` porque el archivo
completo pertenece a otra tarea, no es "trabajo pendiente dentro de T-05".

El único escenario `@wip` real que sí vive dentro del scope de T-05 es "Annotations persist
after reloading the image" en `bounding_box_create_edit.feature` (el resto de ese archivo sí es
de T-05 y sí tiene step definitions en rojo).

## Decisiones abiertas (pendientes de confirmar antes de implementar/TDD)

### ✅ Resuelto: alcance de los operadores de búsqueda (SPEC-08)

**Decisión del PM (2026-09-02):** solo se implementa **AND**. La rúbrica solo dio "car AND
person" como ejemplo; OR y NOT eran una asunción nuestra pendiente de confirmar, y se
descartaron para no rehacer trabajo más adelante sobre algo que el profesor no pidió.
`search_operators.feature` y su step definitions ya se simplificaron para reflejar esto — el
`Feature` ahora se llama "Search with the AND operator over categories", sin escenarios de OR/NOT.

### 🟡 Cómo se verifica "resuelto en SQL, no en memoria" (SPEC-08)

Esto es una decisión de **estrategia de prueba**, no de negocio, así que se
sacó del Gherkin (un escenario de negocio no debería mencionar SQL como
detalle de implementación). El comportamiento observable para el usuario
es "obtengo las imágenes que cumplen la búsqueda" — eso es lo que valida
el `.feature`. La forma de comprobar que el backend en verdad usa SQL y no
un `filter()` en memoria le toca decidirla a quien escriba el step
definition y/o el test unitario del backend, por ejemplo:

- Espiar/mockear el query builder de Drizzle y verificar que la condición
  `AND`/`OR`/`NOT` llega a la cláusula `WHERE` generada, en vez de revisar
  el resultado final.
- O un test de integración con un dataset lo bastante grande para que un
  filtrado en memoria sea detectablemente más lento (frágil, no recomendado
  como única prueba).

Se recomienda la primera opción (verificar la query generada) porque es
determinística y no depende de tiempos de ejecución. Falta que sanchezesteban
confirme qué tan fácil es espiar el query builder con el esquema que arme
en T-03.

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
- Falta mapear los step definitions reales (los `.feature` son la
  especificación, no la implementación) — eso depende de cómo Juan deje el
  setup en T-01 y de cómo sanchezesteban modele el esquema en T-03.
