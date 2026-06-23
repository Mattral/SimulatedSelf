/**
 * Single shared telemetry/correlation id for the current page load.
 *
 * Used by:
 *  - the env preflight (so a missing VITE_SUPABASE_* error is grep-able)
 *  - the ErrorBoundary fallback UI
 *  - the DiagnosticsOverlay
 *  - the first failed Supabase initialization log
 *
 * Same id everywhere → one search reveals the entire failure path.
 */

const STORAGE_KEY = "simself.telemetryId";

function generate(): string {
  const rnd =
    (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `tid_${rnd}`;
}

let cached: string | null = null;

export function getTelemetryId(): string {
  if (cached) return cached;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = generate();
    sessionStorage.setItem(STORAGE_KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // sessionStorage may be unavailable (SSR, privacy mode); fall back to memory.
    cached = generate();
    return cached;
  }
}

export function resetTelemetryId(): void {
  cached = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
