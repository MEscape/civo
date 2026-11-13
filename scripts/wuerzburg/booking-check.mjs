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
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const email = `booking-check-${viewport.name}@example.invalid`;
    const result = {
      viewport: viewport.name,
      service: false,
      calendar: false,
      hold: false,
      validation: false,
      confirmed: false,
      rescheduled: false,
      cancelled: false,
    };
    try {
      await page.goto(`${origin}/de/s/wuerzburg/buergerservice/termine`);
      await page.getByRole('button', { name: /Synthetisch: Unterlagenprüfung/ }).click();
      await page.getByRole('heading', { name: 'An welchem Tag?' }).waitFor();
      result.service = true;
      await page
        .getByRole('button', { name: /, Termine frei$/ })
        .first()
        .click();
      await page.getByRole('heading', { name: 'Um welche Uhrzeit?' }).waitFor();
      result.calendar = true;
      await page
        .getByRole('button', { name: /^\d{2}:\d{2}$/ })
        .first()
        .click();
      await page.getByRole('heading', { name: 'Ihre Angaben' }).waitFor();
      result.hold = true;
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      result.validation = true;
      await page.getByLabel('Vorname', { exact: true }).fill('Demo');
      await page.getByLabel('Nachname', { exact: true }).fill('Browserprüfung');
      await page
        .getByLabel('Termin buchen', { exact: true })
        .getByLabel('E-Mail-Adresse', { exact: true })
        .fill(email);
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await page.getByRole('heading', { name: 'Bitte prüfen Sie Ihre Buchung' }).waitFor();
      await page.getByRole('button', { name: 'Verbindlich buchen', exact: true }).click();
      await page
        .getByRole('heading', { name: 'Ihr Termin ist gebucht' })
        .waitFor({ timeout: 30_000 });
      result.confirmed = true;
      await page.getByRole('link', { name: 'Buchung ansehen, verschieben oder absagen' }).click();
      await page
        .getByLabel('Meine Buchung', { exact: true })
        .getByLabel('E-Mail-Adresse', { exact: true })
        .fill(email);
      await page.getByRole('button', { name: 'Buchung anzeigen', exact: true }).click();
      await page.getByRole('button', { name: 'Termin verschieben', exact: true }).click();
      await page.getByRole('heading', { name: 'Neue Zeit wählen' }).waitFor();
      await page
        .getByRole('button', { name: /, Termine frei$/ })
        .first()
        .click();
      await page
        .getByRole('button', { name: /^\d{2}:\d{2}$/ })
        .last()
        .click();
      await page.getByRole('button', { name: /^Auf .+ verschieben$/ }).click();
      await expect(
        page.getByText('Der Termin ist verschoben. Wir haben Ihnen eine Bestätigung geschickt.'),
      ).toBeVisible();
      result.rescheduled = true;
      await page.getByRole('button', { name: 'Termin absagen', exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Absagen', exact: true }).click();
      await expect(
        page.getByText('Der Termin ist abgesagt. Wir haben Ihnen eine Bestätigung geschickt.'),
      ).toBeVisible();
      result.cancelled = true;
    } catch (error) {
      result.error = error.message;
      await page.screenshot({
        path: `docs/würzburg/verification/booking-${viewport.name}-failure.png`,
        fullPage: true,
      });
    } finally {
      results.push(result);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/würzburg/verification/booking-journey.json',
    `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((result) => !result.cancelled)) process.exitCode = 1;
