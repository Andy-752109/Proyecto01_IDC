import express from 'express';
import { apiRouter } from './routes';

// Minimal Express app for integration tests (Vitest, Cucumber step definitions).
// Deliberately does NOT reuse index.ts's createApp(): that one wires up Vite
// middleware / static file serving and calls app.listen() as a side effect on
// import, which makes it awkward to test in isolation. This mounts only the
// API layer (express.json() + apiRouter), the same router the real server
// uses, so tests exercise the actual route/schema/db code — just without the
// frontend-serving concerns.
export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}
