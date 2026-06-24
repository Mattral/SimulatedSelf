import { getTelemetryId } from "./telemetryId";

const REQUIRED_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export interface PreflightResult {
  ok: boolean;
  /** Vars that are completely absent or empty. */
  missing: string[];
  /** Vars that are present but failed semantic validation. */
  invalid: { name: string; reason: string }[];
  telemetryId: string;
}

/** Accepts https://<anything>.supabase.co and https://<anything>.supabase.in
 *  plus any explicit https URL (self-hosted). Rejects placeholders and http. */
function validateSupabaseUrl(raw: string): string | null {
  const v = raw.trim();
  if (/your[-_]?project|example|changeme|placeholder/i.test(v)) {
    return "looks like a placeholder value";
  }
  let u: URL;
  try { u = new URL(v); } catch { return "not a valid URL"; }
  if (u.protocol !== "https:") return "must use https://";
  if (!u.hostname) return "missing hostname";
  return null;
}

function validatePublishableKey(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 20) return "key is suspiciously short";
  if (/your[-_]?key|placeholder|changeme/i.test(v)) {
    return "looks like a placeholder value";
  }
  return null;
}

export function runEnvPreflight(env: ImportMetaEnv = import.meta.env): PreflightResult {
  const read = (k: string) =>
    (env as unknown as Record<string, string | undefined>)[k];

  const missing = REQUIRED_VARS.filter((k) => {
    const v = read(k);
    return !v || !String(v).trim();
  });

  const invalid: { name: string; reason: string }[] = [];
  if (!missing.includes("VITE_SUPABASE_URL")) {
    const reason = validateSupabaseUrl(String(read("VITE_SUPABASE_URL")));
    if (reason) invalid.push({ name: "VITE_SUPABASE_URL", reason });
  }
  if (!missing.includes("VITE_SUPABASE_PUBLISHABLE_KEY")) {
    const reason = validatePublishableKey(String(read("VITE_SUPABASE_PUBLISHABLE_KEY")));
    if (reason) invalid.push({ name: "VITE_SUPABASE_PUBLISHABLE_KEY", reason });
  }

  const telemetryId = getTelemetryId();
  const ok = missing.length === 0 && invalid.length === 0;
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error("[preflight] env validation failed", {
      telemetryId,
      missing,
      invalid,
      hint: "Set/fix these in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }
  return { ok, missing, invalid, telemetryId };
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
