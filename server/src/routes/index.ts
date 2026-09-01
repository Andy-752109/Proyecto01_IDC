import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Los routers de features (imágenes, anotaciones, categorías, dashboard,
// export COCO, ...) se montan aquí, ej:
// apiRouter.use('/images', imagesRouter);
