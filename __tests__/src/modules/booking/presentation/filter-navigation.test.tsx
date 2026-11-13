import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocationsFilters } from '@modules/booking/presentation/components/locations/locations-filters';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('booking filter navigation', () => {
  it('replaces edited controls with the applied filters after navigation', async () => {
    const props = {
      locale: 'en' as const,
      base: '/locations',
      search: 'Town hall',
      status: 'active' as const,
      pageSize: 25,
    };
    const { rerender } = render(await LocationsFilters(props));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Unsubmitted text' } });

    rerender(await LocationsFilters({ ...props, search: undefined, status: 'all' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');

    rerender(await LocationsFilters(props));
    expect(screen.getByRole('searchbox')).toHaveValue('Town hall');
    expect(screen.getByRole('search', { name: 'locations.filterLabel' })).toHaveAttribute(
      'method',
      'get',
    );
  });
});
