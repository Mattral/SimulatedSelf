import { test, expect } from '@playwright/test';

test.describe('Simulated-Self landing surface', () => {
  test('loads the 3D scene shell without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    // The Three.js canvas should mount.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('exposes the mood / vision diagnostics panel once camera starts', async ({ page }) => {
    await page.goto('/');
    // The PermissionHandler auto-grants under --use-fake-ui-for-media-stream.
    await expect(page.getByText(/Emotion Detection|Mood Detection/i)).toBeVisible({ timeout: 20_000 });
  });
});
