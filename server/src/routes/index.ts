import { Router } from 'express';
import { annotationsRouter } from './annotations';
import { categoriesRouter } from './categories';
import { dashboardRouter } from './dashboard';
import { imagesRouter } from './images';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/annotations', annotationsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/images', imagesRouter);
apiRouter.use('/dashboard', dashboardRouter);

// El resto de routers de features (export COCO, ...) se montan aquí de
// la misma forma.
