import { test, expect, type ConsoleMessage } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Visual regression for the first-load sequence.
 *
 * Captures screenshots at each step and fails specifically on:
 *  - the "supabaseUrl is required" regression (missing VITE_SUPABASE_* in build)
 *  - a generic blank-page state after the app shell should have rendered
 *
 * On failure we also persist a console/pageerror log excerpt next to the
 * screenshots so CI artifacts are self-contained.
 */

const ARTIFACT_DIR = path.join("tests", "e2e", "__screenshots__", "first-load");

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test.describe("first-load visual regression", () => {
  test.use({
    permissions: ["camera", "microphone"],
    viewport: { width: 1280, height: 800 },
  });

  test("renders something non-blank and has no supabaseUrl error", async ({ page }, testInfo) => {
    const logs: string[] = [];
    const errors: string[] = [];

    const record = (msg: ConsoleMessage) => {
      logs.push(`[console.${msg.type()}] ${msg.text()}`);
    };
    page.on("console", record);
    page.on("pageerror", (e) => {
      const line = `[pageerror] ${e.name}: ${e.message}`;
      logs.push(line);
      errors.push(line);
    });

    // Step 1: boot
    await page.goto("/?diag=1", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "01-boot.png") });

    // Step 2: app shell present
    await page.waitForSelector("#root *", { timeout: 10_000 }).catch(() => {});
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "02-shell.png") });

    // Step 3: post-permissions settle
    await page.waitForTimeout(2_000);
    const finalShot = path.join(ARTIFACT_DIR, "03-ready.png");
    await page.screenshot({ path: finalShot });

    // ── Detection: specific supabaseUrl regression ───────────────────────────
    const supabaseFailure = [...logs, ...errors].find((l) =>
      /supabaseUrl is required/i.test(l),
    );

    // The in-app preflight UI renders this testid when env vars are missing.
    const preflightFailureVisible = await page
      .getByTestId("preflight-failure")
      .isVisible()
      .catch(() => false);

    if (supabaseFailure || preflightFailureVisible) {
      const excerpt = logs.slice(-50).join("\n");
      const logPath = path.join(ARTIFACT_DIR, "FAILURE-supabase-url.log");
      fs.writeFileSync(
        logPath,
        [
          `Detected supabaseUrl regression at ${new Date().toISOString()}`,
          `URL: ${page.url()}`,
          `preflightFailureVisible=${preflightFailureVisible}`,
          ``,
          `--- console/pageerror tail (last 50) ---`,
          excerpt,
        ].join("\n"),
      );
      await testInfo.attach("supabase-failure-log", { path: logPath });
      await testInfo.attach("supabase-failure-screenshot", { path: finalShot });

      throw new Error(
        `'supabaseUrl is required' regression detected — VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in build.\n` +
          `See ${logPath} and ${finalShot}.`,
      );
    }

    // ── Detection: generic blank page after shell should be up ───────────────
    const laidOutElementCount = await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) return 0;
      return Array.from(root.querySelectorAll("*"))
        .slice(0, 400)
        .filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 4 && r.height > 4;
        }).length;
    });

    if (laidOutElementCount <= 3) {
      const excerpt = logs.slice(-50).join("\n");
      const logPath = path.join(ARTIFACT_DIR, "FAILURE-blank-page.log");
      fs.writeFileSync(
        logPath,
        [
          `Blank-page regression at ${new Date().toISOString()}`,
          `URL: ${page.url()}`,
          `laidOutElementCount=${laidOutElementCount}`,
          ``,
          `--- console/pageerror tail (last 50) ---`,
          excerpt,
        ].join("\n"),
      );
      await testInfo.attach("blank-page-log", { path: logPath });
      await testInfo.attach("blank-page-screenshot", { path: finalShot });
    }

    expect(laidOutElementCount, "page appears blank after first load").toBeGreaterThan(3);
  });
});
