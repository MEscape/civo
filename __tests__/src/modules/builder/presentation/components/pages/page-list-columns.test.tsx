import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { pageListColumns } from '@modules/builder/presentation/components/pages/page-list-columns';
import type { PageListItemDto } from '@modules/builder/presentation/dto/page-dto';
import enBuilder from '@modules/builder/presentation/i18n/en.json';

import { ResponsiveTable } from '@components/shared/responsive-table';

import { createAppFormatters } from '@i18n/formatters';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const page = (overrides: Partial<PageListItemDto> & { id: string }): PageListItemDto => ({
  websiteId: 'site-1',
  path: overrides.id,
  title: `Title ${overrides.id}`,
  version: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
  outline: null,
  ...overrides,
});

function table(pages: PageListItemDto[]) {
  const t = createTranslator({ locale: 'en', messages: enBuilder, namespace: 'builder' });
  return render(
    <ResponsiveTable
      label="Pages"
      rows={pages}
      rowKey={(row) => row.id}
      columns={pageListColumns({
        t,
        format: createAppFormatters('en', 'UTC'),
        websiteId: 'site-1',
      })}
      state={{ kind: 'ready', empty: null }}
    />,
  );
}

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole('link', { name }).closest<HTMLElement>('[role="row"]');
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

describe('pageListColumns', () => {
  it('names the page, its address and its revision, and links into the editor', () => {
    table([page({ id: 'about', path: 'about' })]);
    const row = rowOf('Title about');

    expect(within(row).getByText('/about')).toBeInTheDocument();
    expect(within(row).getByText('Version 4')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Title about' })).toHaveAttribute(
      'href',
      '/websites/site-1/builder/about',
    );
    expect(within(row).getByRole('link', { name: 'Open Title about' })).toHaveAttribute(
      'href',
      '/websites/site-1/builder/about',
    );
  });

  it('marks the home page, and only it', () => {
    table([page({ id: 'home', path: '' }), page({ id: 'about' })]);

    expect(within(rowOf('Title home')).getByText('Home page')).toBeInTheDocument();
    expect(within(rowOf('Title about')).queryByText('Home page')).toBeNull();
  });
});
