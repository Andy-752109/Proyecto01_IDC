# server/src/db

Propiedad: sanchezesteban (persistencia — Drizzle + MariaDB).

Aquí van:
- `schema.ts` (o varios archivos de esquema) con las tablas Drizzle, FKs, índices y tipos
- `client.ts` con la conexión Drizzle usando `env.DATABASE_URL` (ver `server/src/config/env.ts`)
- Config de `drizzle-kit` (`drizzle.config.ts` en la raíz) y las migraciones generadas en `drizzle/`
- El seeder idempotente (categorías + imágenes de ejemplo)

`DATABASE_URL` ya está definida y validada con Zod en `.env.example` / `server/src/config/env.ts`; solo hace falta importar `env` desde ahí.
