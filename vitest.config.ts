import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['client/src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts'],
    // Los tests de server/src/db y server/src/routes son de integración
    // contra una MariaDB/MinIO reales y compartidas: no pueden correr en
    // paralelo entre archivos sin pisarse entre sí.
    fileParallelism: false,
  },
});
