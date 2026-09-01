import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool } from './client';

async function main(): Promise<void> {
  console.info('Aplicando migraciones...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.info('Migraciones aplicadas correctamente.');
  await pool.end();
}

main().catch((error) => {
  console.error('Error al aplicar migraciones:', error);
  process.exit(1);
});