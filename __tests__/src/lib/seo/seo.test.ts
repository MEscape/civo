import { describe, expect, it } from 'vitest';

import { I18N_CONFIG } from '@i18n';

import {
  buildContentMetadata,
  buildLocalizedMetadata,
  buildPrivateMetadata,
  toLocalizedPath,
} from '@lib/seo';
import { buildAlternateLanguages } from '@lib/seo/build-alternate-languages';

describe('toLocalizedPath', () => {
  it('puts the locale in front of a locale-free path', () => {
    expect(toLocalizedPath('de', '/websites/abc')).toBe('/de/websites/abc');
  });

  it('turns the root into the bare locale, and ignores a trailing slash', () => {
    expect(toLocalizedPath('de', '/')).toBe('/de');
    expect(toLocalizedPath('en', '/news/')).toBe('/en/news');
  });
});

describe('buildAlternateLanguages', () => {
  it('lists the page in every locale, and the default locale as x-default', () => {
    const languages = buildAlternateLanguages('/about');

    for (const locale of I18N_CONFIG.locales) {
      expect(languages[locale]).toBe(`/${locale}/about`);
    }
    expect(languages['x-default']).toBe(`/${I18N_CONFIG.defaultLocale}/about`);
  });

  // The hreflang value is `x-default` in lower case, as the HTML specification and Google's
  // documentation write it; there is no `X-Default`.
  it('spells the default entry x-default, in lower case', () => {
    expect(Object.keys(buildAlternateLanguages('/')).filter((key) => /default/i.test(key))).toEqual(
      ['x-default'],
    );
  });
});

describe('buildLocalizedMetadata', () => {
  const metadata = buildLocalizedMetadata({
    locale: 'de',
    pathname: '/about',
    title: 'Über uns',
    description: 'Wer wir sind',
  });

  it('carries the title and description', () => {
    expect(metadata).toMatchObject({ title: 'Über uns', description: 'Wer wir sind' });
  });

  it('names its own localized URL as the canonical one, with every language as an alternate', () => {
    expect(metadata.alternates).toEqual({
      canonical: '/de/about',
      languages: buildAlternateLanguages('/about'),
    });
  });

  it('describes itself to social previews in its language, naming the other languages', () => {
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: 'Civo',
      title: 'Über uns',
      url: '/de/about',
      locale: 'de_DE',
      alternateLocale: ['en_US'],
    });
  });
});

describe('buildContentMetadata', () => {
  const metadata = buildContentMetadata({
    pathname: '/s/springfield/about',
    title: 'About Springfield',
    description: 'The town',
    siteName: 'Springfield',
  });

  it('has an absolute title: the website is the brand, not the platform', () => {
    expect(metadata.title).toEqual({ absolute: 'About Springfield' });
  });

  it('claims one canonical URL in the default locale and no language alternates', () => {
    expect(metadata.alternates).toEqual({
      canonical: `/${I18N_CONFIG.defaultLocale}/s/springfield/about`,
    });
  });

  it('names the website, not the platform, in the social preview', () => {
    expect(metadata.openGraph).toMatchObject({
      siteName: 'Springfield',
      url: `/${I18N_CONFIG.defaultLocale}/s/springfield/about`,
    });
  });
});

describe('buildPrivateMetadata', () => {
  it('has a title and keeps the page out of search results, advertising nothing else', () => {
    expect(buildPrivateMetadata('Sign in')).toEqual({
      title: 'Sign in',
      robots: { index: false, follow: false },
    });
  });
});
