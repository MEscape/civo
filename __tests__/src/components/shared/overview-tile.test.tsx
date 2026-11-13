import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OverviewTile, OverviewTiles } from '@components/shared/data-panel';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('OverviewTile', () => {
  it('is one link that names the subject, its figure and what goes with it', () => {
    render(
      <OverviewTiles>
        <OverviewTile label="Pages" value="12" detail="Latest: Home" hint="Add one" href="/pages" />
      </OverviewTiles>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/pages');
    expect(link).toHaveTextContent('Pages12Latest: HomeAdd one');
  });

  it('marks a figure that asks for attention, and leaves empty lines out', () => {
    const { container } = render(
      <OverviewTile label="Warnings" value="3" detail="" tone="warning" href="/audit" />,
    );

    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('link')).toHaveTextContent('Warnings3');
  });
});
