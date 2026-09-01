import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './config/env';
import { apiRouter } from './routes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '../../client');
const clientDist = path.resolve(clientRoot, 'dist');

async function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api', apiRouter);

  if (env.NODE_ENV === 'production') {
    // En producción, Express sirve el build estático de Vite. Un solo
    // proceso, un solo puerto: eso es lo que hace esto un monolito.
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    // En desarrollo, Vite corre en modo middleware dentro del mismo
    // proceso Express: sigue siendo un único puerto (env.PORT), con HMR.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, '../../vite.config.ts'),
      root: clientRoot,
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexHtmlPath = path.resolve(clientRoot, 'index.html');
        const template = await vite.transformIndexHtml(
          url,
          await (await import('node:fs/promises')).readFile(indexHtmlPath, 'utf-8'),
        );
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  return app;
}

createApp()
  .then((app) => {
    app.listen(env.PORT, () => {
      console.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  })
  .catch((error) => {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  });
