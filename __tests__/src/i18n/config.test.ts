import { notFound } from 'next/navigation';

import { describe, expect, it, vi } from 'vitest';

import {
  I18N_CONFIG,
  getDirection,
  getMessageFallback,
  isLocale,
  normalizeLocale,
  parseLocale,
  requireLocale,
} from '../../../src/i18n/config';

vi.mock('next/navigation', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
  };
});

describe('i18n config', () => {
  it('has a definition for every locale, and the default is one of them', () => {
    for (const locale of I18N_CONFIG.locales) {
      expect(I18N_CONFIG.definitions[locale].openGraphLocale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      expect(I18N_CONFIG.definitions[locale].label).toBeTruthy();
      expect(I18N_CONFIG.definitions[locale].htmlLang).toBe(locale);
    }
    expect(I18N_CONFIG.locales).toContain(I18N_CONFIG.defaultLocale);
  });

  it('identifies and normalizes locale codes', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(123)).toBe(false);

    expect(normalizeLocale('en-US').unwrapOr(null)).toBe('en');
    expect(normalizeLocale('de_DE').unwrapOr(null)).toBe('de');
    expect(normalizeLocale('fr-FR').isErr()).toBe(true);
    expect(normalizeLocale(null).isErr()).toBe(true);
  });

  it('parses exactly the supported locale codes', () => {
    expect(parseLocale('de').isOk()).toBe(true);
    expect(parseLocale('fr').isErr()).toBe(true);
    expect(parseLocale('DE').isErr()).toBe(true);
    expect(parseLocale(undefined).isErr()).toBe(true);
  });

  it('turns an unsupported route locale into not found', () => {
    expect(requireLocale('en')).toBe('en');
    expect(() => requireLocale('xx')).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('reads the direction from the locale definition', () => {
    expect(getDirection('en')).toBe('ltr');
    expect(getDirection('de')).toBe('ltr');
  });

  it('falls back to the qualified key, marked in development', () => {
    expect(getMessageFallback({ namespace: 'app', key: 'x' }, false)).toBe('app.x');
    expect(getMessageFallback({ key: 'x' }, false)).toBe('x');
    expect(getMessageFallback({ namespace: 'app', key: 'x' }, true)).toBe('⚠ app.x');
  });
});
