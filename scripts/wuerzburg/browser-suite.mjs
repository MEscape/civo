import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const loadFromSkill = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const loadFromProject = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = loadFromSkill('playwright');
const helpers = loadFromSkill('./lib/helpers');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ARTIFACTS = path.join(ROOT, 'docs/würzburg/verification');
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'large-desktop', width: 1920, height: 1080 },
  { name: 'reflow-320', width: 320, height: 800 },
];

function mapCount(node) {
  return (
    Number(node.type === 'map') +
    (node.children ?? []).reduce((count, child) => count + mapCount(child), 0)
  );
}

async function captureKeyPage(page, item, viewport) {
  if (
    ['', 'karten', 'stadt-in-zahlen', 'buergerservice/termine'].includes(item.path) &&
    ['desktop', 'reflow-320'].includes(viewport.name)
  ) {
    await page.screenshot({
      path: path.join(
        ARTIFACTS,
        `${item.path.replaceAll('/', '-') || 'home'}-${viewport.name}.png`,
      ),
      fullPage: true,
    });
  }
}

(async () => {
  const servers = await helpers.detectDevServers();
  const origin = process.env.TARGET_URL || servers[0];
  if (!origin) throw new Error('No local server detected');
  const manifest = JSON.parse(
    await fs.readFile(path.join(ROOT, 'data/seeds/wuerzburg.json'), 'utf8'),
  );
  const axe = await fs.readFile(loadFromProject.resolve('axe-core/axe.min.js'), 'utf8');
  const browser = await chromium.launch({ headless: false });
  const results = [];
  const thirdPartyRequests = new Set();
  await fs.mkdir(ARTIFACTS, { recursive: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      globalThis.__civicPerformance = { layoutShift: 0, lcp: null };
      new globalThis.PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) globalThis.__civicPerformance.layoutShift += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new globalThis.PerformanceObserver((list) => {
        globalThis.__civicPerformance.lcp = list.getEntries().at(-1)?.startTime ?? null;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== new URL(origin).origin)
        thirdPartyRequests.add(`${url.origin}${url.pathname}`);
    });
    const selectedPaths = process.argv
      .find((argument) => argument.startsWith('--pages='))
      ?.slice(8)
      .split(',');
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const item of manifest.pages.filter(
        (candidate) =>
          candidate.path !== 'component-lab' &&
          (selectedPaths === undefined || selectedPaths.includes(candidate.path)),
      )) {
        const errors = [];
        const onError = (error) => errors.push(error.message);
        page.on('pageerror', onError);
        try {
          const url = `${origin}/de/s/wuerzburg${item.path ? `/${item.path}` : ''}`;
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
          await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 45_000 });
          await page.locator('main').waitFor({ timeout: 15_000 });
          const text = await page.locator('body').innerText();
          const overflow = await page.evaluate(
            () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
          );
          await page.addScriptTag({ content: axe });
          const accessibility = await page.evaluate(async () => {
            const report = await globalThis.axe.run(globalThis.document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
            });
            return {
              violations: report.violations.map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                description: violation.description,
                nodes: violation.nodes.map((node) => ({
                  target: node.target,
                  summary: node.failureSummary,
                })),
              })),
              incomplete: report.incomplete.map((entry) => entry.id),
            };
          });
          const result = {
            page: item.path || '/',
            viewport: viewport.name,
            status: response.status(),
            title: await page.title(),
            h1Count: await page.getByRole('heading', { level: 1 }).count(),
            mainCount: await page.getByRole('main').count(),
            horizontalOverflow: overflow,
            unavailableSections: (
              text.match(/Dieser Abschnitt ist vorübergehend nicht verfügbar/g) || []
            ).length,
            expectedMaps: mapCount(item.config),
            renderedMaps: await page.getByRole('img', { name: /^Karte: / }).count(),
            developmentPerformance: await page.evaluate(() => globalThis.__civicPerformance),
            errors,
            ...accessibility,
          };
          results.push(result);
          await captureKeyPage(page, item, viewport);
          process.stdout.write(
            `${viewport.name} ${item.path || '/'}: HTTP ${result.status}; axe ${result.violations.length}; overflow ${overflow}; unavailable ${result.unavailableSections}\n`,
          );
        } catch (error) {
          results.push({ page: item.path || '/', viewport: viewport.name, error: error.message });
          process.stdout.write(
            `${viewport.name} ${item.path || '/'}: ${error.message.slice(0, 180)}\n`,
          );
        } finally {
          page.off('pageerror', onError);
        }
        await fs.writeFile(
          path.join(
            ARTIFACTS,
            selectedPaths === undefined ? 'browser-suite.json' : 'browser-recheck.json',
          ),
          `${JSON.stringify({ capturedAt: new Date().toISOString(), origin, thirdPartyRequests: [...thirdPartyRequests], results }, null, 2)}\n`,
        );
      }
    }
    const failed = results.filter(
      (result) =>
        result.error ||
        result.status !== 200 ||
        result.h1Count !== 1 ||
        result.mainCount !== 1 ||
        result.horizontalOverflow ||
        result.unavailableSections > 0 ||
        result.renderedMaps !== result.expectedMaps ||
        result.violations?.length ||
        result.errors?.length,
    );
    process.stdout.write(
      `Completed ${results.length} page/viewport checks; ${failed.length} failures; ${thirdPartyRequests.size} third-party requests.\n`,
    );
    if (failed.length || thirdPartyRequests.size) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
