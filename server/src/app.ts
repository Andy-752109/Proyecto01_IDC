import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes';

export function createApiApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  // Manejador de errores centralizado: cualquier error no atrapado en un
  // handler de /api/* cae aquí en vez del handler HTML por default de
  // Express, que expondría el stack trace al cliente.
  app.use('/api', (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
