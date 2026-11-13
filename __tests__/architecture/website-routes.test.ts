import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { builderRoutes } from '@modules/builder/client';
import { releaseRoutes } from '@modules/release/client';
import { websiteRoutes } from '@modules/website/client';

const ROOT = join(process.cwd(), 'src/app/[locale]/(protected)');

/** Match actual App Router folders, including route groups that contribute no URL segment. */
function routeExists(directory: string, segments: readonly string[]): boolean {
  if (segments.length === 0 && existsSync(join(directory, 'page.tsx'))) {
    return true;
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .some((entry) => {
      if (entry.name.startsWith('(')) {
        return routeExists(join(directory, entry.name), segments);
      }
      if (segments.length === 0) {
        return false;
      }
      return (
        (entry.name === segments[0] || /^\[[^\]]+\]$/.test(entry.name)) &&
        routeExists(join(directory, entry.name), segments.slice(1))
      );
    });
}

describe('website navigation and invalidation route contracts', () => {
  it('invalidates the authored website layout pattern, including locale and route group', () => {
    expect(builderRoutes.websiteLayout).toBe(websiteRoutes.layout);
    expect(existsSync(join(process.cwd(), 'src/app', websiteRoutes.layout, 'layout.tsx'))).toBe(
      true,
    );
  });
  const id = 'site-1';
  for (const href of [
    websiteRoutes.list(),
    websiteRoutes.create(),
    websiteRoutes.detail(id),
    websiteRoutes.settings(id),
    websiteRoutes.users(id),
    websiteRoutes.audit(id),
    websiteRoutes.platformUsers(),
    websiteRoutes.platformAudit(),
    builderRoutes.pages(id),
    builderRoutes.create(id),
    builderRoutes.editor(id, 'page-1'),
    builderRoutes.component(id, 'page-1', 'hero'),
    releaseRoutes.releases(id),
  ]) {
    it(`${href} resolves to an authored page`, () => {
      expect(routeExists(ROOT, href.split('?')[0]?.split('/').filter(Boolean) ?? [])).toBe(true);
    });
  }
});
