import { Router } from 'express';
import { fetchCocoDataset } from './coco.service';

export const cocoExportRouter = Router();

// GET /api/export/coco -> descarga el dataset completo en formato COCO
cocoExportRouter.get('/coco', async (_req, res) => {
  try {
    const dataset = await fetchCocoDataset();
    const filename = `dataset-coco-${Date.now()}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).json(dataset);
  } catch (error) {
    console.error('Error al exportar el dataset a formato COCO:', error);
    res.status(500).json({ error: 'No se pudo generar la exportación COCO.' });
  }
});
