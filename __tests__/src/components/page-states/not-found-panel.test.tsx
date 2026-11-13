import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundPanel } from '@components/page-states/not-found-panel';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

describe('NotFoundPanel', () => {
  it('does not invent a destination when the caller cannot supply one', () => {
    render(<NotFoundPanel title="Not found" description="No page here" />);
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers the caller-approved destination', () => {
    render(
      <NotFoundPanel
        title="Not found"
        description="No page here"
        action={{ href: '/websites', label: 'Websites' }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Websites' })).toHaveAttribute('href', '/websites');
  });
});
