import { slugify } from '@lib/utils';

/**
 * Turns what someone typed into a path the domain accepts: slash-separated
 * slugs, no leading or trailing slash. An empty result is the home page.
 * `slugify` alone would turn every `/` into a hyphen, so it works per segment.
 */
export function normalizePagePath(input: string): string {
  return input
    .split('/')
    .map(slugify)
    .filter((segment) => segment !== '')
    .join('/');
}
