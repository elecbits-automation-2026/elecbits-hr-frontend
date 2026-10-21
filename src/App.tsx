import { BrowserRouter } from 'react-router-dom';

import RouteErrorBoundary from '@components/Common/Utilities/RouteErrorBoundary.component';
import AppProviders from '@providers/AppProviders.provider';
import AppRoutes from '@routes/routes.index';

/*
 * The app shell: router, global providers, route table. Split out of main.tsx
 * so the entry file does nothing but mount.
 *
 * BrowserRouter sits outside AppProviders because the auth guard inside them
 * navigates, and a router hook called above its own Router throws. The error
 * boundary wraps everything so a provider that fails to mount still renders a
 * readable screen.
 */
const App = () => (
  <BrowserRouter>
    <RouteErrorBoundary>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </RouteErrorBoundary>
  </BrowserRouter>
);

export default App;
