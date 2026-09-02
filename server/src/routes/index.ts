import { Router } from 'express';
import { imagesRouter } from './images';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/images', imagesRouter);

// El resto de routers de features (anotaciones, categorías, dashboard,
// export COCO, ...) se montan aquí de la misma forma.
