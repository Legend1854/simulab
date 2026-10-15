import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node-environment tests (marked with @vitest-environment node) have no DOM.
const hasDom = typeof window !== 'undefined';

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  window.localStorage.clear();
});

if (hasDom) {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom does not provide.
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}
