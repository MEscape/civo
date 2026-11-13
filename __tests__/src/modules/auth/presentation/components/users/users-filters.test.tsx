import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UsersFilters } from '@modules/auth/presentation/components/users/users-filters';

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

describe('user list filters', () => {
  it('restores member controls from the URL after reset and history navigation', async () => {
    const props = { pathname: '/users', text: 'Alice', role: null, pageSize: 25, sort: 'name' };
    const { rerender } = render(await UsersFilters(props));

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Unsubmitted text' } });
    rerender(await UsersFilters({ ...props, text: null }));
    expect(screen.getByRole('searchbox')).toHaveValue('');

    rerender(await UsersFilters(props));
    expect(screen.getByRole('searchbox')).toHaveValue('Alice');
    expect(screen.getByRole('link', { name: 'users.filters.reset' })).toHaveAttribute(
      'href',
      '/users?sort=name',
    );
  });

  it('restores cross-website controls when the URL changes and keeps the sort on reset', async () => {
    const props = {
      pathname: '/people',
      text: 'Alice',
      websiteId: null,
      role: null,
      pageSize: 25,
      sort: 'email',
      websites: [],
    };
    const { rerender } = render(await UsersFilters(props));

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Unsubmitted text' } });
    rerender(await UsersFilters({ ...props, text: null }));

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('link', { name: 'users.filters.reset' })).toHaveAttribute(
      'href',
      '/people?sort=email',
    );
  });

  it('offers a website choice only across websites', async () => {
    const { rerender } = render(
      await UsersFilters({
        pathname: '/people',
        text: null,
        role: null,
        pageSize: 25,
        sort: 'name',
        websites: [{ id: 'one', name: 'One' }],
        websiteId: 'one',
      }),
    );
    expect(screen.getByRole('combobox', { name: 'users.filters.website' })).toHaveTextContent(
      'One',
    );

    rerender(
      await UsersFilters({
        pathname: '/users',
        text: null,
        role: null,
        pageSize: 25,
        sort: 'name',
      }),
    );
    expect(
      screen.queryByRole('combobox', { name: 'users.filters.website' }),
    ).not.toBeInTheDocument();
  });

  it('treats platform administration as a role in the shared filter', async () => {
    render(
      await UsersFilters({
        pathname: '/users',
        text: null,
        role: 'platform_admin',
        pageSize: 25,
        sort: 'name',
      }),
    );
    expect(screen.getByRole('combobox', { name: 'users.filters.role' })).toHaveTextContent(
      'users.roles.platformAdmin',
    );
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
});
