import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PUBLIC = join(ROOT, 'src/app/[locale]/(public)');
const PAGE_SEGMENT = join(PUBLIC, 's/[siteSlug]/[[...path]]');
const RENDERER = join(
  ROOT,
  'src/modules/component-platform/presentation/components/page-renderer/page-node-renderer.tsx',
);

/**
 * A streamed segment arrives as `<div hidden>` that only an inline script
 * reveals, so these guard what keeps a published page readable without
 * JavaScript (docs/rules/nextjs.md).
 */
describe('published pages are complete HTML', () => {
  it('blocks the route instead of streaming it', () => {
    expect(readFileSync(join(PAGE_SEGMENT, 'page.tsx'), 'utf8')).toMatch(
      /export const instant = false;/,
    );
  });

  it('has no loading boundary above the published page', () => {
    expect(existsSync(join(PAGE_SEGMENT, 'loading.tsx'))).toBe(false);
    expect(existsSync(join(PUBLIC, 'loading.tsx'))).toBe(false);
  });

  it('renders blocks without Suspense', () => {
    expect(readFileSync(RENDERER, 'utf8')).not.toMatch(/<Suspense|import \{[^}]*\bSuspense\b/);
  });
});
