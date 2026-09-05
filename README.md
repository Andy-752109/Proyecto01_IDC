# Portal de Anotación de Imágenes

Portal web para anotar imágenes con bounding boxes, gestionar categorías, revisar métricas en un dashboard y exportar el dataset en formato COCO.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript (sirve el build de Vite — un solo proceso, un solo puerto)
- Validación: Zod 4
- ORM: Drizzle · Base de datos: MariaDB · Imágenes: MinIO
- Anotador: Konva + react-konva · Dashboard: Recharts
- Testing: Vitest + React Testing Library · BDD: Cucumber.js
- Calidad: Biome · Entorno: Docker Compose

## Estado actual: setup y arquitectura base

Esto es un scaffold de arranque, no features. Lo que ya está hecho y probado:

- **Monolito real, un solo puerto**: Express sirve el build de Vite en producción; en desarrollo corre Vite en modo middleware dentro del mismo proceso Express (con HMR). No hay dos servidores ni dos puertos que coordinar — `npm run dev` levanta todo.
- **Config por entorno con Zod**: `server/src/config/env.ts` valida `process.env` (cargado desde `.env` con `dotenv`) al arrancar. Si falta o está mal una variable, el server falla rápido con un mensaje claro en vez de fallar más adelante de forma confusa.
- **`.env.example`** versionado con placeholders (sin secretos reales) para MariaDB y MinIO. `.env` real está en `.gitignore`.
- **Docker Compose** con tres servicios (`app`, `mariadb`, `minio`), healthchecks, y todas las credenciales/puertos/buckets leídos de `.env` — nada hardcodeado.
- **TypeScript estricto**: `tsconfig.base.json` (compartido) + `tsconfig.client.json` / `tsconfig.server.json`, con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `npm run typecheck` pasa sin errores.
- **Biome** configurado (`biome.json`) prohibiendo `any` explícito y `console.log`, con `npm run check` en 0 errores / 0 warnings.
- **Separación UI / Lógica / Datos**: la UI (`client/`) nunca importa nada de `server/src/db` ni del cliente de MinIO. Todo pasa por `/api/*` (`server/src/routes/`).
- **Vitest** (unit/componentes) y **Cucumber.js** (Gherkin) cableados y funcionando, sin contenido todavía — listos para que se agreguen tests y `.feature` files sin tocar configuración.
- **Carpetas de trabajo delimitadas** para el resto del equipo, cada una con su propio README explicando qué va ahí:
  - `server/src/db/` → esquema Drizzle, migraciones, seeder (sanchezesteban)
  - `features/` → SPECs, `.feature` en Gherkin, step definitions (alebonita)

Verificado manualmente: `npm install`, `npm run typecheck`, `npm run check`, `docker compose up mariadb minio -d`, y `npm run dev` sirviendo la app en `:3000` con `/api/health` respondiendo `{"status":"ok"}`.

## Cómo correrlo

### Requisitos

- Node.js 22+
- Docker y Docker Compose

### Setup inicial

```bash
cp .env.example .env
npm install
```

### Desarrollo (hot reload, puerto 3000)

Levanta solo la infraestructura (MariaDB + MinIO) con Docker, y el proceso Node de la app en local:

```bash
docker compose up mariadb minio -d
npm run dev
```

App disponible en `http://localhost:3000`. Health check: `http://localhost:3000/api/health`.

Para parar: `Ctrl+C` en la terminal de `npm run dev`, y `docker compose down`.

### Producción / monolito completo (puerto 3100)

​```bash
docker compose up --build
​```

Levanta app + MariaDB + MinIO con un solo comando. La app sirve el build de React y la API desde el mismo proceso/puerto. El puerto de este servicio está fijo en `3100` dentro de `docker-compose.yml` (no depende de `PORT` en tu `.env`, que sigue siendo `3000` para el modo on-premise) — no hace falta editar nada a mano entre un modo y otro.

### Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor Express + Vite en modo middleware (HMR), puerto `PORT` (default 3000) |
| `npm run build` | Build de producción del cliente (`client/dist`) |
| `npm start` | Arranca el servidor en modo producción (sirve `client/dist`) |
| `npm run typecheck` | `tsc --noEmit` sobre cliente y servidor (TypeScript estricto) |
| `npm test` | Pruebas unitarias/componentes (Vitest) |
| `npm run test:bdd` | Escenarios Gherkin (Cucumber.js) |
| `npm run check` | Lint + format check (Biome) |
| `npm run check:fix` | Autofix de Biome |

## Estructura

```
client/            React + Vite (UI)
server/src/
  index.ts         Entry point: Express + integración Vite
  config/env.ts     Config validada con Zod (.env)
  routes/           Routers de la API (/api/*)
  lib/minio.ts       Cliente MinIO
  db/               Esquema Drizzle, migraciones, seeder (ver server/src/db/README.md)
features/           SPECs en Gherkin + step definitions (ver features/README.md)
```

La UI nunca accede a MariaDB ni a MinIO directamente: todo pasa por `/api/*` en el servidor Express.

## Qué falta

Nada de esto está implementado todavía — el scaffold solo deja la base lista para construirlo:

**Persistencia**
- Esquema Drizzle (imágenes, anotaciones, categorías) con FKs, índices y tipos
- Migraciones versionadas (`drizzle-kit`) que se apliquen desde cero sin pasos manuales
- Seeder idempotente con categorías + imágenes de ejemplo
- Conexión Drizzle usando `DATABASE_URL` (ya validado en `server/src/config/env.ts`)

**SPECs / Gherkin / TDD**
- Trazabilidad regla de negocio → SPEC → `.feature` (Given/When/Then)
- Ciclo Red → Green → Refactor visible en commits separados (no se puede armar al final)
- Cobertura de reglas críticas de anotación y exportación COCO

**Features de producto**
- Subida de imágenes con validación de tipo/tamaño y feedback (MinIO)
- Editor de bounding boxes (Konva): crear, mover, redimensionar, borrar, persistencia al recargar
- Categorías con color, validación de que ninguna caja quede sin clase
- Zoom, deshacer, navegación entre imágenes, "guardar y siguiente"
- Dashboard con métricas reales desde la BD (no hardcodeadas), gráficas (Recharts)
- Búsqueda con operadores (`car AND person`) resuelta en SQL, filtros combinables + paginación
- Exportación del dataset a COCO (JSON válido, ids consistentes, bbox en píxeles absolutos, descarga)

**Pendiente de setup**
- CI (lint + typecheck + tests en cada push/PR)
- Dockerfile de producción sin probar aún end-to-end (build + run completo)
- Decidir si se agrega autenticación (no está en la rúbrica como requisito explícito)
