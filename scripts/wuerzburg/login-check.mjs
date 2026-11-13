import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const load = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const project = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium, expect } = load('playwright/test');
const { parse } = project('dotenv');
const helpers = load('./lib/helpers');
const origin = process.env.TARGET_URL || (await helpers.detectDevServers())[0];
if (!origin) throw new Error('No local server detected');
const password =
  process.env.WUERZBURG_DEMO_PASSWORD ||
  parse(await fs.readFile('.env.wuerzburg.local')).WUERZBURG_DEMO_PASSWORD;
if (!password) throw new Error('No development credential available');
const browser = await chromium.launch({ headless: false });
const manifest = JSON.parse(await fs.readFile('data/seeds/wuerzburg.json', 'utf8'));
const results = [];
try {
  for (const role of ['admin', 'viewer', 'editor', 'contributor', 'employee', 'platform_admin']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/de/sign-in`);
      await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(`${role}@example.invalid`);
      await page.getByLabel('Passwort', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
      await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/, { timeout: 30_000 });
      await page.getByRole('main').waitFor();
      // The platform admin is no member of the website; it must still open it from the list.
      if (role === 'admin' || role === 'platform_admin') {
        await page.goto(`${origin}/de/websites/${manifest.websiteId}`);
        await expect(
          page.getByRole('heading', { level: 1, name: manifest.website.name, exact: true }),
        ).toBeVisible();
        // A late client-side lookup used to replace the page with 'not found' after it rendered.
        await page.waitForTimeout(5000);
        await expect(
          page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' }),
        ).toHaveCount(0);
      }
      results.push({ role, passed: true, path: new URL(page.url()).pathname });
    } catch {
      // Never serialize locator diagnostics or a screenshot of a form containing a credential.
      results.push({
        role,
        passed: false,
        reason:
          'Login did not reach a protected page; inspect locally without recording credentials',
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/würzburg/verification/demo-login.json',
    `${JSON.stringify({ capturedAt: new Date().toISOString(), results, limitation: 'Authentication and landing page only; role-specific write denials and cross-tenant access not exercised.' }, null, 2)}\n`,
  );
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
