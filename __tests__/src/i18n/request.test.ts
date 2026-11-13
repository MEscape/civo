import { IntlError, IntlErrorCode } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  nodeEnv: 'development',
  englishLoads: 0,
  failEnglish: false,
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@lib/config/server', () => ({
  serverEnv: {
    get NODE_ENV() {
      return state.nodeEnv;
    },
  },
}));
vi.mock('@lib/logger', () => ({ logger: { warn: state.warn, error: state.error } }));
vi.mock('next-intl/server', () => ({ getRequestConfig: (factory: unknown) => factory }));
vi.mock('@i18n/locales/en', () => ({
  get default() {
    state.englishLoads++;
    if (state.failEnglish) {
      throw new Error('catalog unavailable');
    }
    return { app: { loading: 'Loading', fallback: 'English fallback' } };
  },
}));
vi.mock('@i18n/locales/de', () => ({ default: { app: { loading: 'Laden' } } }));

beforeEach(() => {
  vi.resetModules();
  state.nodeEnv = 'development';
  state.englishLoads = 0;
  state.failEnglish = false;
  state.warn.mockClear();
  state.error.mockClear();
});

describe('request message loading', () => {
  it('reloads development catalogs and keeps their authored contents', async () => {
    const { loadRequestMessages } = await import('@i18n/request');
    expect(await loadRequestMessages('de')).toEqual({ app: { loading: 'Laden' } });
    await loadRequestMessages('en');
    await loadRequestMessages('en');
    expect(state.englishLoads).toBe(2);
  });

  it('merges missing default-locale keys in production and shares concurrent reads', async () => {
    state.nodeEnv = 'production';
    const { loadRequestMessages } = await import('@i18n/request');
    const [first, second] = await Promise.all([
      loadRequestMessages('de'),
      loadRequestMessages('de'),
    ]);
    expect(first).toEqual({ app: { loading: 'Laden', fallback: 'English fallback' } });
    expect(second).toBe(first);
    expect(state.englishLoads).toBe(1);
    expect(await loadRequestMessages('en')).toEqual({
      app: { loading: 'Loading', fallback: 'English fallback' },
    });
  });

  it('logs load failures and evicts a rejected production cache entry so a later read can recover', async () => {
    state.nodeEnv = 'production';
    state.failEnglish = true;
    const { loadRequestMessages } = await import('@i18n/request');
    await expect(loadRequestMessages('en')).rejects.toThrow(
      'Failed to load messages for locale "en"',
    );
    expect(state.error).toHaveBeenCalledWith(
      'Failed to load locale message catalog',
      expect.any(Error),
      expect.objectContaining({ locale: 'en' }),
    );
    state.failEnglish = false;
    expect(await loadRequestMessages('en')).toEqual({
      app: { loading: 'Loading', fallback: 'English fallback' },
    });
  });

  it('falls back from an unsupported request locale and supplies development message diagnostics', async () => {
    const { default: configure } = await import('@i18n/request');
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Exercise the requestLocale callback that the current production adapter still supports.
    const config = await configure({ requestLocale: Promise.resolve('fr') });
    expect(config.locale).toBe('en');
    expect(config.timeZone).toBe('Europe/Berlin');
    expect(
      config.getMessageFallback?.({
        namespace: 'app',
        key: 'missing',
        error: new IntlError(IntlErrorCode.MISSING_MESSAGE),
      }),
    ).toBe('⚠ app.missing');
  });

  it.each([
    IntlErrorCode.MISSING_MESSAGE,
    IntlErrorCode.INVALID_KEY,
    IntlErrorCode.FORMATTING_ERROR,
  ])('classifies %s without losing diagnostic information', async (code) => {
    const { handleIntlError } = await import('@i18n/request');
    const error = new IntlError(code, 'Diagnostic');
    handleIntlError(error);
    if (code === IntlErrorCode.FORMATTING_ERROR) {
      expect(state.error).toHaveBeenCalledWith(
        'Translation runtime error',
        error,
        expect.objectContaining({ code }),
      );
    } else {
      expect(state.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code:
            code === IntlErrorCode.MISSING_MESSAGE
              ? 'i18n.missingMessage'
              : 'i18n.invalidMessageKey',
          detail: error.message,
        }),
      );
    }
  });
});
