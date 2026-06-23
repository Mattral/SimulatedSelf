import { getTelemetryId } from "./telemetryId";

const REQUIRED_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export interface PreflightResult {
  ok: boolean;
  missing: string[];
  telemetryId: string;
}

export function runEnvPreflight(env: ImportMetaEnv = import.meta.env): PreflightResult {
  const missing = REQUIRED_VARS.filter((k) => {
    const v = (env as unknown as Record<string, string | undefined>)[k];
    return !v || !String(v).trim();
  });
  const telemetryId = getTelemetryId();
  if (missing.length) {
    // Single log line — same telemetry id surfaced in the UI fallback.
    // eslint-disable-next-line no-console
    console.error("[preflight] missing required env vars", {
      telemetryId,
      missing,
      hint: "Set these in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }
  return { ok: missing.length === 0, missing, telemetryId };
}

export function renderPreflightFailure(result: PreflightResult): void {
  const root = document.getElementById("root");
  if (!root) return;

  const list = result.missing.map((m) => `<li><code>${m}</code></li>`).join("");

  root.innerHTML = `
    <div role="alert" data-testid="preflight-failure"
      style="min-height:100vh;padding:2rem;background:#0b0b12;color:#f4f4f5;
             font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;">
      <div style="max-width:880px;margin:0 auto;">
        <h1 style="font-size:1.5rem;margin-bottom:0.5rem;">
          App can't start — missing environment variables
        </h1>
        <p style="opacity:0.8;margin-bottom:1rem;">
          The Supabase client could not be initialized. Add the variables below
          to your hosting provider (e.g. Vercel → Settings → Environment Variables)
          and redeploy.
        </p>
        <ul style="background:#16161f;border:1px solid #2a2a35;border-radius:8px;
                   padding:0.75rem 1.5rem;margin-bottom:1rem;">
          ${list}
        </ul>
        <div style="background:#16161f;border:1px solid #2a2a35;border-radius:8px;
                    padding:0.75rem 1rem;">
          <strong>Telemetry ID:</strong>
          <code data-testid="telemetry-id">${result.telemetryId}</code>
        </div>
      </div>
    </div>
  `;
}
