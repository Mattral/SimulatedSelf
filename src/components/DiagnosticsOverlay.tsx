import { useEffect, useState } from "react";
import { getTelemetryId } from "@/lib/telemetryId";


export type RenderStage =
  | "boot"
  | "permissions"
  | "loading-models"
  | "calibrating"
  | "ready";

interface Props {
  stage: RenderStage;
  cameraPermission?: PermissionState | "unknown";
  extra?: Record<string, string | number | boolean | undefined>;
}

/**
 * Lightweight on-screen overlay that reports which render stage the app is
 * currently in plus the camera permission state. Helpful for diagnosing
 * "blank screen on first load" reports in production.
 *
 * Enable with `?diag=1` in the URL, or `localStorage.setItem('diag','1')`.
 */
export function DiagnosticsOverlay({ stage, cameraPermission = "unknown", extra }: Props) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("diag") === "1";
    const fromStorage =
      typeof localStorage !== "undefined" && localStorage.getItem("diag") === "1";
    setEnabled(fromQuery || fromStorage);
  }, []);

  if (!enabled) return null;

  return (
    <div
      data-testid="diagnostics-overlay"
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 9999,
        padding: "8px 10px",
        background: "rgba(0,0,0,0.72)",
        color: "#a7f3d0",
        font: "11px ui-monospace, Menlo, monospace",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.1)",
        pointerEvents: "none",
        maxWidth: 320,
      }}
    >
      <div>tid: <span data-testid="diag-telemetry-id">{getTelemetryId()}</span></div>
      <div>stage: <span data-testid="diag-stage">{stage}</span></div>
      <div>camera: <span data-testid="diag-camera">{cameraPermission}</span></div>
      {extra &&
        Object.entries(extra).map(([k, v]) => (
          <div key={k}>
            {k}: {String(v)}
          </div>
        ))}
    </div>
  );
}

export default DiagnosticsOverlay;
