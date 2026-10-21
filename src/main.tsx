import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

/*
 * The client entry — mount only. Everything that composes the app (router,
 * providers, route table) lives in App.tsx; the global stylesheet is pulled in
 * here because this is the one module guaranteed to be evaluated first.
 */
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
