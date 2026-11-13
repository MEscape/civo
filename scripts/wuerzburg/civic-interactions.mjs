import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const skill = createRequire(path.join(process.env.PW_SKILL_DIR, 'package.json'));
const { chromium } = skill('playwright');
const { expect } = skill('playwright/test');
const origin = process.env.TARGET_URL || 'http://localhost:3000';
const browser = await chromium.launch({ headless: false });
const results = [];
const external = new Set();
let activePage;
let phase = 'start';
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    activePage = page;
    phase = `${width}: map`;
    page.on('request', (request) => {
      const target = new URL(request.url());
      if (target.protocol.startsWith('http') && target.origin !== origin)
        external.add(target.origin);
    });
    await page.goto(`${origin}/de/s/wuerzburg/mobilitaet`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    if (width < 1024) await page.getByText('Menü', { exact: true }).click();
    assert.equal(
      await page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .getByRole('link', { name: 'Mobilität', exact: true })
        .getAttribute('aria-current'),
      'page',
    );
    const image = page.getByRole('img', { name: 'Karte: Rad abstellen', exact: true });
    await image.waitFor();
    await page.waitForLoadState('networkidle');
    const map = page.locator('section').filter({ has: image }).first();
    const paths = await image.locator('path').count();
    assert.ok(paths >= 177, `Expected complete bicycle-place geography, saw ${paths} paths`);
    phase = `${width}: map pointer selection`;
    await image.locator('[data-feature-key]').last().click();
    await map.getByRole('complementary', { name: 'Ausgewählter Ort' }).waitFor();
    await map.getByRole('button', { name: 'Details schließen' }).click();
    await map.locator('summary').filter({ hasText: 'Alle Orte' }).click();
    const place = map.getByRole('button', { name: /auf der Karte zeigen/ }).first();
    phase = `${width}: map keyboard selection`;
    await place.focus();
    await page.keyboard.press('Enter');
    await map.getByRole('complementary', { name: 'Ausgewählter Ort' }).waitFor();
    const previous = await image.getAttribute('viewBox');
    await map.getByRole('button', { name: 'Vergrößern', exact: true }).click();
    assert.notEqual(await image.getAttribute('viewBox'), previous);
    await map.getByRole('button', { name: 'Details schließen' }).click();
    assert.equal(
      await map
        .getByRole('group', { name: 'Karte: Rad abstellen', exact: true })
        .evaluate((element) => element === globalThis.document.activeElement),
      true,
    );
    await page.screenshot({
      path: `docs/würzburg/verification/mobility-${width}.png`,
      fullPage: true,
    });
    results.push({ width, paths, mapSelection: true, mapZoom: true, closeFocus: true });

    phase = `${width}: chart`;
    await page.goto(`${origin}/de/s/wuerzburg/umwelt-klima`, { waitUntil: 'domcontentloaded' });
    const chart = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: /Main: Wasserstand im Tagesverlauf/ }),
      })
      .first();
    await chart.getByText('Daten als Tabelle anzeigen', { exact: true }).click();
    const region = chart.getByRole('region');
    assert.equal(await region.getByRole('row').count(), 21);
    const firstTime = await region.getByRole('row').nth(1).innerText();
    const messages = JSON.parse(await readFile('src/i18n/messages/de.json', 'utf8'));
    await chart.getByRole('button', { name: messages.pagination.next, exact: true }).click();
    await expect.poll(() => region.getByRole('row').nth(1).innerText()).not.toBe(firstTime);
    const beforeZoom = await chart
      .getByRole('status')
      .filter({ hasText: 'Messwerte:' })
      .innerText();
    const initialCount = Number(/Messwerte: (\d+)/.exec(beforeZoom)?.[1]);
    assert.ok(initialCount > 1);
    await chart.getByRole('button', { name: 'Hineinzoomen', exact: true }).click();
    await chart
      .getByRole('status')
      .filter({ hasText: `Messwerte: ${Math.floor(initialCount / 2)} ·` })
      .waitFor();
    await page.waitForFunction(() =>
      [...globalThis.document.querySelectorAll('.recharts-cartesian-axis-tick-value')].some(
        (element) => /\d{2}:\d{2}/.test(element.textContent ?? ''),
      ),
    );
    await page.screenshot({
      path: `docs/würzburg/verification/environment-${width}.png`,
      fullPage: true,
    });

    phase = `${width}: service`;
    await page.goto(`${origin}/de/s/wuerzburg/buergerservice`, { waitUntil: 'domcontentloaded' });
    const search = page.getByRole('searchbox').first();
    await search.fill('Termin');
    await page.getByRole('link', { name: /Termin im Bürgerbüro/ }).click();
    await page.getByRole('heading', { name: 'Gut vorbereitet zum Termin', exact: true }).waitFor();
    const appointment = page.getByRole('link', { name: 'Zum städtischen Buchungsportal' });
    assert.equal(
      await appointment.getAttribute('href'),
      'https://www.wuerzburg.de/rathaus/buergerbuero/terminvereinbarung',
    );
    assert.equal(
      await page.getByRole('textbox').count(),
      0,
      'Official appointment page must not collect local citizen data',
    );
    results.push({
      width,
      paths,
      mapSelection: true,
      mapZoom: true,
      closeFocus: true,
      tablePagination: true,
      intradayTicks: true,
      serviceToBooking: true,
    });
    process.stdout.write(`${width}px civic interactions passed\n`);
    await page.close();
  }
  assert.equal(external.size, 0);
} catch (error) {
  results.push({
    phase,
    error: error.message,
    ticks: await activePage
      ?.locator('.recharts-cartesian-axis-tick-value')
      .allTextContents()
      .catch(() => []),
    statuses: await activePage
      ?.getByRole('status')
      .allTextContents()
      .catch(() => []),
  });
  await activePage
    ?.screenshot({
      path: 'docs/würzburg/verification/civic-interaction-failure.png',
      fullPage: true,
    })
    .catch(() => undefined);
  process.stdout.write(`${phase}: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await writeFile(
    'docs/würzburg/verification/civic-interactions.json',
    JSON.stringify(
      { capturedAt: new Date().toISOString(), results, thirdPartyRequests: [...external] },
      null,
      2,
    ) + '\n',
  );
  await browser.close();
}
