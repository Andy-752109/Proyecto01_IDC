import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadDotenv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL es requerido para drizzle-kit. Revisa tu archivo .env');
}

export default defineConfig({
  dialect: 'mysql',
  schema: './server/src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});