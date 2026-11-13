import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const load = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const project = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = load('playwright');
const helpers = load('./lib/helpers');
const origin = process.env.TARGET_URL || (await helpers.detectDevServers())[0];
if (!origin) throw new Error('No local server detected');
const brands = JSON.parse(
  await fs.readFile('docs/würzburg/verification/brand-tokens.json', 'utf8'),
);
const axe = await fs.readFile(project.resolve('axe-core/axe.min.js'), 'utf8');
const results = [];
const browser = await chromium.launch({ headless: false });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  for (const pagePath of ['', 'mobilitaet', 'stadt-in-zahlen', 'buergerservice/termine']) {
    await page.goto(`${origin}/de/s/wuerzburg/${pagePath}`);
    await page.getByRole('main').waitFor();
    await page.addScriptTag({ content: axe });
    for (const brand of brands) {
      await page.locator('[data-civo-theme]').evaluate((element, tokens) => {
        for (const [key, value] of Object.entries(tokens)) element.style.setProperty(key, value);
      }, brand.tokens);
      const violations = await page.evaluate(async () => {
        const report = await globalThis.axe.run(globalThis.document, {
          runOnly: { type: 'rule', values: ['color-contrast'] },
        });
        return report.violations.map((entry) => ({
          id: entry.id,
          nodes: entry.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        }));
      });
      results.push({ page: pagePath || '/', brand: brand.name, violations });
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/würzburg/verification/brand-matrix.json',
    `${JSON.stringify({ capturedAt: new Date().toISOString(), method: 'Existing themeToCssVariables tokens injected into the actual theme wrapper; axe text contrast at desktop with reduced motion. UI/focus contrast and persisted theme mutation not exercised.', results }, null, 2)}\n`,
  );
}
process.stdout.write(
  `${results.length} page/brand checks; ${results.filter((result) => result.violations.length).length} failures.\n`,
);
if (results.some((result) => result.violations.length)) process.exitCode = 1;
