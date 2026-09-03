import { Router } from 'express';
import { cocoExportRouter } from '../export/coco.router';
import { annotationsRouter } from './annotations';
import { categoriesRouter } from './categories';
import { imagesRouter } from './images';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/annotations', annotationsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/export', cocoExportRouter);
apiRouter.use('/images', imagesRouter);

// El resto de routers de features (dashboard, ...) se montan aquí de la
// misma forma.
