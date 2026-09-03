import { useState } from 'react';

type ExportStatus = 'idle' | 'loading' | 'error';

export function ExportCocoButton() {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleExport() {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/export/coco');

      if (!response.ok) {
        throw new Error(`El servidor respondió con estado ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `dataset-coco-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      setStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`No se pudo exportar el dataset: ${message}`);
      setStatus('error');
    }
  }

  return (
    <div>
      <button type="button" onClick={handleExport} disabled={status === 'loading'}>
        {status === 'loading' ? 'Exportando...' : 'Exportar dataset (COCO)'}
      </button>
      {status === 'error' && errorMessage ? (
        <p role="alert" style={{ color: '#b00020' }}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
