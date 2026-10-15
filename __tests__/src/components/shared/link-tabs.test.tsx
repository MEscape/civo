import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LinkTabs } from '@components/shared/link-tabs';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('LinkTabs', () => {
  it('are addresses, with the current one marked', () => {
    render(
      <LinkTabs
        label="Parts"
        activeKey="services"
        tabs={[
          { key: 'calendar', label: 'Calendar', href: '/bookings?tab=calendar' },
          { key: 'services', label: 'Services', href: '/bookings?tab=services' },
        ]}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Parts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'href',
      '/bookings?tab=services',
    );
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Calendar' })).not.toHaveAttribute('aria-current');
  });
});
