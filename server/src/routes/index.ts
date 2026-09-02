import { Router } from 'express';
import { annotationsRouter } from './annotations';
import { categoriesRouter } from './categories';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/annotations', annotationsRouter);

// Otros routers de features (imágenes, dashboard, export COCO, ...) se
// montan aquí conforme se implementen, ej:
// apiRouter.use('/images', imagesRouter);
