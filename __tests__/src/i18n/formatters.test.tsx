import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { createAppFormatters } from '../../../src/i18n/formatters';
import { useAppFormatters } from '../../../src/i18n/formatters/client';

const SAMPLE_DATE = new Date('2026-03-05T12:00:00Z');

describe('createAppFormatters', () => {
  it('formats numbers and dates in the locale it is bound to', () => {
    const en = createAppFormatters('en');
    const de = createAppFormatters('de');

    expect(en.number(1234.5)).toBe('1,234.5');
    expect(de.number(1234.5)).toBe('1.234,5');
    expect(en.date(SAMPLE_DATE)).not.toBe(de.date(SAMPLE_DATE));
  });

  it('formats in the given time zone and defaults to the configured one', () => {
    const berlin = createAppFormatters('en', 'Europe/Berlin');
    const tokyo = createAppFormatters('en', 'Asia/Tokyo');

    expect(berlin.dateTime(SAMPLE_DATE)).not.toBe(tokyo.dateTime(SAMPLE_DATE));
    expect(createAppFormatters('en').dateTime(SAMPLE_DATE)).toBe(berlin.dateTime(SAMPLE_DATE));
  });

  it('exposes percent, money, bytes and relative time', () => {
    const de = createAppFormatters('de');

    expect(de.percent(0.5)).toContain('50');
    expect(de.money(1999, 'EUR')).toContain('19,99');
    expect(de.bytes(2048)).toContain('2');
    expect(de.relativeTime(SAMPLE_DATE, new Date('2026-03-05T12:00:30Z'))).toBeTruthy();
  });
});

describe('useAppFormatters', () => {
  function wrapperFor(locale: 'en' | 'de') {
    return function Wrapper({ children }: { readonly children: ReactNode }) {
      return (
        <NextIntlClientProvider locale={locale} messages={{}}>
          {children}
        </NextIntlClientProvider>
      );
    };
  }

  it('follows the provider locale', () => {
    const { result } = renderHook(() => useAppFormatters(), { wrapper: wrapperFor('de') });

    expect(result.current.number(1234.5)).toBe('1.234,5');
  });

  it('is referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useAppFormatters(), {
      wrapper: wrapperFor('en'),
    });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
