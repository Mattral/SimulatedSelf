import { defineMcp } from "@lovable.dev/mcp-js";
import getAppOverview from "./tools/get-app-overview";
import checkVisionModels from "./tools/check-vision-models";
import explainTrackingPipeline from "./tools/explain-tracking-pipeline";

export default defineMcp({
  name: "simself",
  title: "SimSelf",
  version: "0.1.0",
  instructions:
    "Tools for SimSelf, a browser-based pose/emotion tracking and 3D avatar app. Use `get_app_overview` for what the app does, `explain_tracking_pipeline` for how the pose, emotion, calibration or voice pipelines work, and `check_vision_models` to preflight the public face-api model weight files on a deployed instance.",
  tools: [getAppOverview, explainTrackingPipeline, checkVisionModels],
});
