import express, { type Express } from 'express';
import { apiRouter } from './routes';

export function createApiApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
}
