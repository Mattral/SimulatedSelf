import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

const MODEL_FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
  "face_expression_model-weights_manifest.json",
  "face_expression_model.bin",
];

export default defineTool({
  name: "check_vision_models",
  title: "Check vision model assets",
  description:
    "Preflight the public face-api model weight files hosted by the app and report which ones are reachable. Useful for diagnosing emotion-detection failures.",
  inputSchema: {
    baseUrl: z
      .string()
      .url()
      .describe(
        "Public origin of the deployed app, e.g. https://simulated-self.vercel.app. Model files are checked under <baseUrl>/models/.",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ baseUrl }) => {
    let origin: URL;
    try {
      origin = new URL(baseUrl);
    } catch {
      throw new ToolError("baseUrl must be a valid absolute URL.");
    }
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
      throw new ToolError("baseUrl must use https (or be localhost).");
    }

    const results = await Promise.all(
      MODEL_FILES.map(async (file) => {
        const url = new URL(`/models/${file}`, origin).toString();
        const started = Date.now();
        try {
          const res = await fetch(url, { method: "GET", redirect: "follow" });
          const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
          return {
            file,
            url,
            ok: res.ok,
            status: res.status,
            bytes,
            latencyMs: Date.now() - started,
          };
        } catch (error) {
          return {
            file,
            url,
            ok: false,
            status: 0,
            bytes: 0,
            latencyMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    const summary = { ok: results.every((r) => r.ok), checked: results.length, results };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
      isError: !summary.ok,
    };
  },
});
