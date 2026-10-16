import { test, expect } from '@playwright/test';

test.describe('Over the Hill (Web) E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for canvas to be attached and initialized
    await page.waitForSelector('#canvas-container canvas', { timeout: 15000 });
  });

  test('loads game with correct title and canvas', async ({ page }) => {
    await expect(page).toHaveTitle(/Over the Hill/);
    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible();
  });

  test('displays cockpit Inclinometer HUD with pitch and roll angles', async ({ page }) => {
    const inclinometer = page.locator('#inclinometer-hud');
    await expect(inclinometer).toBeVisible();

    const pitchVal = page.locator('#pitch-val');
    const rollVal = page.locator('#roll-val');
    await expect(pitchVal).toBeVisible();
    await expect(rollVal).toBeVisible();
  });

  test('displays Gauge Cluster with speedometer and 4WD status badges', async ({ page }) => {
    const cluster = page.locator('#gauge-cluster');
    await expect(cluster).toBeVisible();

    const speed = page.locator('#gauge-speed');
    const gear = page.locator('#gauge-gear');
    const tcase = page.locator('#badge-tcase');
    const diff = page.locator('#badge-diff');

    await expect(speed).toBeVisible();
    await expect(gear).toBeVisible();
    await expect(tcase).toContainText(/4H/);
    await expect(diff).toContainText(/DIFF OPEN/);
  });

  test('toggles Differential Lock and Transfer Case on keypress', async ({ page }) => {
    const diffBadge = page.locator('#badge-diff');
    const tcaseBadge = page.locator('#badge-tcase');

    // Press 'L' to toggle Differential Lock
    await page.keyboard.press('KeyL');
    await expect(diffBadge).toContainText('DIFF LOCKED');

    // Press 'L' again to unlock
    await page.keyboard.press('KeyL');
    await expect(diffBadge).toContainText('DIFF OPEN');

    // Press 'H' to toggle Transfer Case to 4L
    await page.keyboard.press('KeyH');
    await expect(tcaseBadge).toContainText('4L');
  });

  test('displays trail controls guide overlay', async ({ page }) => {
    const guide = page.locator('#controls-guide');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('Trail Controls');
  });
});
