import { buildQueryString } from '@lib/utils';

/** Shared query-only origin mechanics; each list's schema owns which filters may travel. */
export const listNavigation = {
  readOrigin: (raw: string | string[] | undefined) => {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined) {
      return undefined;
    }
    const params = new URLSearchParams(value);
    return Object.fromEntries([...params.keys()].map((key) => [key, params.get(key) ?? undefined]));
  },
  withOrigin: (href: string, origin: string | undefined) =>
    origin === undefined
      ? href
      : `${href}${href.includes('?') ? '&' : '?'}${buildQueryString({ list: origin }).slice(1)}`,
  parent: (base: string, origin: string | undefined) =>
    `${base}${origin === undefined ? '' : `?${origin}`}`,
};
