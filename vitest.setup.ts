import '@testing-library/jest-dom/vitest';

// jsdom no implementa ResizeObserver; Recharts (ResponsiveContainer) lo
// necesita para montar sin tronar, aunque en jsdom nunca vaya a "disparar"
// un resize real.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
