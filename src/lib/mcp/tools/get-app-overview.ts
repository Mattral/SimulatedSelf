import { defineTool } from "@lovable.dev/mcp-js";

const OVERVIEW = {
  name: "SimSelf",
  summary:
    "A browser-based simulated-self app: a webcam drives real-time body/hand pose tracking (MediaPipe), facial emotion analytics (face-api.js in a Web Worker), and a 3D humanoid robot avatar rendered with Three.js, plus a streaming voice chat pipeline.",
  capabilities: [
    "MediaPipe pose + hand landmark tracking with mirror/direct view modes",
    "SVD-based hand calibration mapping palm pose to 3D rotation with One-Euro smoothing",
    "Facial emotion detection offloaded to a Web Worker with tunable detector thresholds",
    "3D humanoid robot avatar driven by live landmarks",
    "Streaming voice chat with listening / processing / streaming / speaking states",
    "Observability: OpenTelemetry tracing, Prometheus metrics, readiness and drain endpoints",
  ],
  visionModels: ["tiny_face_detector", "face_expression"],
  notes:
    "All tracking runs client-side in the browser; no user data is stored server-side.",
};

export default defineTool({
  name: "get_app_overview",
  title: "Get app overview",
  description:
    "Return a structured overview of SimSelf: what it does, its capabilities, and the vision models it uses.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(OVERVIEW, null, 2) }],
    structuredContent: OVERVIEW,
  }),
});
