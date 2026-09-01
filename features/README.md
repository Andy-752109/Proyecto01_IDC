# features/

Propiedad: alebonita (SPECs + Gherkin + ciclo TDD).

- `*.feature`: escenarios en Given/When/Then, uno por regla de negocio, con trazabilidad a su SPEC.
- `step-definitions/`: implementación de los steps en TypeScript, usando `@cucumber/cucumber`.

El runner ya está cableado (`cucumber.cjs` en la raíz, script `npm run test:bdd`). No hace falta tocar configuración, solo agregar `.feature` y sus step definitions.

Recordatorio de la rúbrica: el ciclo Red → Green → Refactor debe quedar visible en commits separados, no solo el resultado final.
