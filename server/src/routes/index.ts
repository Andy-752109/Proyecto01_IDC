import { Router } from 'express';
import { cocoExportRouter } from '../export/coco.router';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/export', cocoExportRouter);

// Los demás routers de features (imágenes, anotaciones, categorías,
// dashboard, ...) se montan aquí, ej:
// apiRouter.use('/images', imagesRouter);
