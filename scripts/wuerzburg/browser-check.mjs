import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const loadFromSkill = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const { chromium } = loadFromSkill('playwright');
const helpers = loadFromSkill('./lib/helpers');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ARTIFACTS = path.join(ROOT, 'docs/würzburg/verification');

(async () => {
  const servers = await helpers.detectDevServers();
  process.stdout.write(`Detected servers: ${JSON.stringify(servers)}\n`);
  const target = process.env.TARGET_URL || 'http://localhost:3000';
  const browser = await chromium.launch({ headless: false });
  await fs.mkdir(ARTIFACTS, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const requests = [];
    const failures = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== new URL(target).origin)
        requests.push(`${url.origin}${url.pathname}`);
    });
    page.on('pageerror', (error) => failures.push(error.message));
    const response = await page.goto(`${target}/de/s/wuerzburg`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 60_000 });
    const summary = {
      capturedAt: new Date().toISOString(),
      url: page.url(),
      status: response.status(),
      title: await page.title(),
      headings: await page.getByRole('heading').allTextContents(),
      body: (await page.locator('body').innerText()).slice(0, 12_000),
      thirdPartyRequests: [...new Set(requests)],
      pageErrors: failures,
      horizontalOverflow: await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
    };
    await page.screenshot({ path: path.join(ARTIFACTS, 'home-desktop.png'), fullPage: true });
    await fs.writeFile(
      path.join(ARTIFACTS, 'browser-smoke.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (summary.status !== 200 || failures.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
