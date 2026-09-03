import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import {
  type DashboardSummary,
  type ObjectsByCategory,
  fetchDashboardSummary,
  fetchObjectsByCategory,
} from '../../api/dashboard';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: DashboardSummary; objectsByCategory: ObjectsByCategory };

export function Dashboard() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        const [summary, objectsByCategory] = await Promise.all([
          fetchDashboardSummary(),
          fetchObjectsByCategory(),
        ]);
        if (!cancelled) {
          setState({ status: 'ready', summary, objectsByCategory });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: (error as Error).message });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <section aria-label="Dashboard">
        <output>Cargando métricas...</output>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section aria-label="Dashboard">
        <p role="alert">No se pudieron cargar las métricas del dashboard: {state.message}</p>
      </section>
    );
  }

  const { summary, objectsByCategory } = state;
  const progressPercent =
    summary.totalImages === 0
      ? 0
      : Math.round((summary.annotatedImages / summary.totalImages) * 100);

  return (
    <section aria-label="Dashboard">
      <h2>Dashboard</h2>

      <dl>
        <div>
          <dt>Total de imágenes</dt>
          <dd data-testid="metric-total-images">{summary.totalImages}</dd>
        </div>
        <div>
          <dt>Imágenes anotadas</dt>
          <dd data-testid="metric-annotated-images">{summary.annotatedImages}</dd>
        </div>
        <div>
          <dt>Total de bounding boxes</dt>
          <dd data-testid="metric-total-boxes">{summary.totalBoundingBoxes}</dd>
        </div>
        <div>
          <dt>Categorías</dt>
          <dd data-testid="metric-total-categories">{summary.totalCategories}</dd>
        </div>
      </dl>

      <h3>Progreso de anotación</h3>
      <p>
        {summary.annotatedImages} de {summary.totalImages} imágenes anotadas ({progressPercent}%)
      </p>
      <div
        role="progressbar"
        tabIndex={0}
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: '#e5e5e5', borderRadius: 4, height: 8, width: '100%' }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            background: '#2a9d8f',
            height: '100%',
            borderRadius: 4,
          }}
        />
      </div>

      <h3>Objetos por clase</h3>
      {/* Ancho fijo (no ResponsiveContainer): en jsdom, ResponsiveContainer
          nunca mide un tamaño real (no hay ResizeObserver que dispare), así
          que no renderiza nada y el chart queda imposible de testear. Con
          ancho fijo se sacrifica el resize automático a cambio de un chart
          que sí se puede probar de verdad; el overflow-x cubre pantallas
          angostas. */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <BarChart
          width={600}
          height={280}
          data={objectsByCategory}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <XAxis dataKey="categoryName" tickLine={false} axisLine={{ stroke: '#d4d4d4' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: '#d4d4d4' }} />
          <Tooltip />
          <Bar dataKey="objectCount" radius={[4, 4, 0, 0]}>
            {objectsByCategory.map((category) => (
              <Cell key={category.categoryId} fill={category.color} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </section>
  );
}
