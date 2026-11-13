import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const load = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const { chromium, expect } = load('playwright/test');
const helpers = load('./lib/helpers');
const origin = process.env.TARGET_URL || (await helpers.detectDevServers())[0];
if (!origin) throw new Error('No local server detected');
const browser = await chromium.launch({ headless: false });
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    forcedColors: 'active',
  });
  await page.goto(`${origin}/de/s/wuerzburg`);
  await page.getByRole('main').waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Hauptinhalt springen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  results.push({
    mode: 'forced-colors/reduced-motion',
    check: 'Keyboard Tab and Enter move from skip link to main',
    passed: true,
  });
  await page.close();
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  const publicPages = [
    '',
    'buergerservice',
    'buergerservice/termine',
    'buergerservice/abfall',
    'mobilitaet',
    'umwelt-klima',
    'stadt-in-zahlen',
    'rathaus-politik',
    'kontakt',
    'impressum',
    'datenschutz',
    'barrierefreiheit',
  ];
  for (const pagePath of publicPages) {
    const noScript = await context.newPage();
    const response = await noScript.goto(`${origin}/de/s/wuerzburg/${pagePath}`);
    await expect(noScript.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(noScript.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(noScript.getByRole('main')).toHaveCount(1);
    // Streamed segments stay in `div[hidden]` without scripts; a complete response has none.
    const hiddenSegments = await noScript.locator('div[hidden][id^="S:"]').count();
    const visibleChars = (await noScript.getByRole('main').innerText()).trim().length;
    results.push({
      mode: 'no JavaScript / 320px',
      page: pagePath || '/',
      status: response.status(),
      hiddenSegments,
      visibleChars,
      passed: response.status() === 200 && hiddenSegments === 0 && visibleChars > 200,
    });
    await noScript.close();
  }
  await context.close();
} catch (error) {
  results.push({ passed: false, error: error.message });
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/würzburg/verification/accessibility-modes.json',
    `${JSON.stringify({ capturedAt: new Date().toISOString(), results, limitation: 'Automated Chromium emulation and skip-link keyboard check only; no manual screen-reader, full interactive-map keyboard, or visual forced-color review.' }, null, 2)}\n`,
  );
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
