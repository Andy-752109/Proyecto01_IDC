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

| SPEC ID | Regla de negocio | Sección rúbrica | Archivo .feature |
|---------|-------------------|------------------|-------------------|
| SPEC-01 | Solo se aceptan imágenes de tipo y tamaño válidos, con feedback al usuario | 4. Portal de anotación | `image_upload.feature` |
| SPEC-02 | Una caja (bounding box) se puede crear, mover, redimensionar y borrar, y persiste al recargar | 4. Portal de anotación | `bounding_box_create_edit.feature` |
| SPEC-03 | Ninguna caja puede guardarse sin una categoría válida asignada | 4. Portal de anotación | `bounding_box_requires_category.feature` |
| SPEC-04 | El usuario puede hacer zoom, deshacer, navegar entre imágenes y usar "guardar y siguiente", incluyendo qué pasa si hay cambios sin guardar al navegar | 4. Portal de anotación | `annotation_navigation.feature` |
| SPEC-05 | El dataset exportado es un JSON COCO válido con `images`, `annotations` y `categories`, con IDs consistentes entre secciones (7 pts) | 6. Salida COCO | `coco_export_structure.feature` |
| SPEC-06 | El `bbox` se exporta como `[x, y, width, height]` en píxeles absolutos, con `area` coherente e `iscrowd` presente (3 pts) | 6. Salida COCO | `coco_bbox_format.feature` |
| SPEC-07 | El dataset completo se puede descargar como archivo, sin excluir nada (2 pts) — separado de SPEC-06 porque en la rúbrica es un sub-punto distinto | 6. Salida COCO | `coco_full_export.feature` |
| SPEC-08 | La búsqueda soporta operadores booleanos entre categorías (ver "Decisiones abiertas" — alcance aún no confirmado) | 5. Dashboard y búsqueda | `search_operators.feature` |
| SPEC-09 | Los filtros por clase, estado y rango de fechas son combinables y los resultados se paginan correctamente | 5. Dashboard y búsqueda | `filters_and_pagination.feature` |

## Decisiones abiertas (pendientes de confirmar antes de implementar/TDD)

### 🔴 Alcance real de los operadores de búsqueda (SPEC-08)

La rúbrica dice "Búsqueda con operadores, tipo car AND person, resuelta en
SQL" — da un solo ejemplo (AND) pero usa "operadores" en plural, lo que
sugiere que podría esperarse más de uno. `search_operators.feature` por
ahora asume que **AND, OR y NOT** están en scope y lo dice explícito en un
comentario al inicio del archivo. Esto se puede resolver de dos formas:

1. Preguntarle directamente al profesor en el canal (como él mismo ofreció).
2. Si no hay respuesta a tiempo, quedarnos con la asunción documentada y
   dejar claro en el README o en el PR que fue una decisión de equipo, no
   un vacío sin resolver.

Si la respuesta es que solo se evalúa AND, hay que borrar los escenarios de
OR y NOT en `search_operators.feature` para no gastar tiempo implementando
algo fuera de rúbrica.

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
