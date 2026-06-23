import { createRoot } from 'react-dom/client'
import './index.css'
import { runEnvPreflight, renderPreflightFailure } from './lib/envPreflight'

async function bootstrap() {
  const preflight = runEnvPreflight();
  if (!preflight.ok) {
    renderPreflightFailure(preflight);
    return;
  }

  // Defer importing App (and the supabase client) until after preflight,
  // so a missing env var renders our diagnostic UI instead of throwing
  // during module evaluation.
  const [{ default: App }, { ErrorBoundary }] = await Promise.all([
    import('./App.tsx'),
    import('./components/ErrorBoundary'),
  ]);

  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

bootstrap();
