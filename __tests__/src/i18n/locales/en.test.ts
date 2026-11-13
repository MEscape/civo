import { describe, expect, it, vi } from 'vitest';

import de from '@i18n/locales/de';
import en from '@i18n/locales/en';

vi.mock('@modules/auth', async () => ({
  enAuth: (await import('@modules/auth/presentation/i18n/en.json')).default,
  deAuth: (await import('@modules/auth/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/audit', async () => ({
  enAudit: (await import('@modules/audit/presentation/i18n/en.json')).default,
  deAudit: (await import('@modules/audit/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/booking', async () => ({
  enBooking: (await import('@modules/booking/presentation/i18n/en.json')).default,
  deBooking: (await import('@modules/booking/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/builder', async () => ({
  enBuilder: (await import('@modules/builder/presentation/i18n/en.json')).default,
  deBuilder: (await import('@modules/builder/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/component-platform', async () => ({
  enComponentPlatform: (await import('@modules/component-platform/presentation/i18n/en.json'))
    .default,
  deComponentPlatform: (await import('@modules/component-platform/presentation/i18n/de.json'))
    .default,
}));
vi.mock('@modules/data-sources', async () => ({
  enDataSource: (await import('@modules/data-sources/presentation/i18n/en.json')).default,
  deDataSource: (await import('@modules/data-sources/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/map', async () => ({
  enMap: (await import('@modules/map/presentation/i18n/en.json')).default,
  deMap: (await import('@modules/map/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/media', async () => ({
  enMedia: (await import('@modules/media/presentation/i18n/en.json')).default,
  deMedia: (await import('@modules/media/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/release', async () => ({
  enRelease: (await import('@modules/release/presentation/i18n/en.json')).default,
  deRelease: (await import('@modules/release/presentation/i18n/de.json')).default,
}));
vi.mock('@modules/website', async () => ({
  enWebsite: (await import('@modules/website/presentation/i18n/en.json')).default,
  deWebsite: (await import('@modules/website/presentation/i18n/de.json')).default,
}));

describe('assembled locale catalogs', () => {
  it.each([en, de])(
    'preserves module-owned namespaces without leaking password text into the app namespace',
    (catalog) => {
      expect(Object.keys(catalog).sort()).toEqual([
        'app',
        'audit',
        'auth',
        'booking',
        'builder',
        'componentPlatform',
        'dataSources',
        'map',
        'media',
        'release',
        'website',
      ]);
      expect(catalog.auth.password.toggle).toBeTruthy();
      expect(catalog.app).not.toHaveProperty('password');
      expect(catalog.website.pages.list.title).toBeTruthy();
      expect(catalog.audit).toHaveProperty('list');
      expect(catalog.media.library.title).toBeTruthy();
      expect(catalog.builder.pages.list.title).toBeTruthy();
      expect(catalog.componentPlatform.hero.defaultTitle).toBeTruthy();
    },
  );

  it('selects the corresponding language rather than copying English into both catalogs', () => {
    expect(en.auth.password.toggle).toBe('Show password');
    expect(de.auth.password.toggle).toBe('Passwort anzeigen');
    expect(en.app.loading).not.toBe(de.app.loading);
  });
});
