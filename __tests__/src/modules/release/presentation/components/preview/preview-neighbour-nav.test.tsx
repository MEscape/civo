import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { PreviewNeighbourNav } from '@modules/release/presentation/components/preview/preview-neighbour-nav';
import enRelease from '@modules/release/presentation/i18n/en.json';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enRelease, namespace: 'release' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('release preview neighbours', () => {
  it('preserves the originating history slice in both directions', async () => {
    render(
      await PreviewNeighbourNav({
        locale: 'en',
        websiteId: 'site',
        from: { page: 3, pageSize: 50 },
        older: { id: 'older', releaseNumber: 1 },
        newer: { id: 'newer', releaseNumber: 3 },
      }),
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/websites/site/releases/older/preview?from=3&fromPageSize=50',
      '/websites/site/releases/newer/preview?from=3&fromPageSize=50',
    ]);
  });

  it('disables the unavailable direction at the end of history', async () => {
    render(
      await PreviewNeighbourNav({
        locale: 'en',
        websiteId: 'site',
        from: { page: 1, pageSize: 10 },
        older: null,
        newer: null,
      }),
    );
    expect(screen.getByRole('button', { name: 'Older' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
