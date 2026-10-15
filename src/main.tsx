import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/public-sans';
import './styles/app.css';
import { App } from './app/App';
import { createAppStore } from './app/store';
import { clearAllStoredData, getBrowserStore } from './services/persistence/storage';

const { store: storage, persistent } = getBrowserStore();
const appStore = createAppStore({ storage, persistent });

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element.');

createRoot(container).render(
  <StrictMode>
    <App store={appStore} onResetData={() => clearAllStoredData(storage)} />
  </StrictMode>,
);
