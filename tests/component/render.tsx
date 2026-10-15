import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { createAppStore } from '../../src/app/store';
import { MemoryStore } from '../../src/services/persistence/storage';

/** Renders the whole app at a hash route with an in-memory store, as the browser would. */
export function renderApp(hash: string, storage = new MemoryStore()) {
  window.location.hash = hash;
  const store = createAppStore({ storage, persistent: true });
  const user = userEvent.setup();
  const utils = render(<App store={store} onResetData={() => undefined} />);
  return { ...utils, store, storage, user };
}
