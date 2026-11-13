import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from '@components/shared/pagination';

import type { Page } from '@lib/pagination';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, number>) => {
    if (key === 'pagination.page') {
      return `Page ${values?.['page']}`;
    }
    if (key === 'pagination.summary') {
      return `${values?.['first']}-${values?.['last']} of ${values?.['total']}`;
    }
    return key;
  },
}));
vi.mock('@i18n', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function sliceOf(page: number, pageCount: number): Page<unknown> {
  return {
    items: Array.from({ length: 25 }, (_, index) => index),
    page,
    pageSize: 25,
    total: pageCount * 25,
    pageCount,
  };
}

async function renderPagination(page: number, pageCount: number) {
  return render(
    await Pagination({
      locale: 'en',
      slice: sliceOf(page, pageCount),
      hrefFor: (target) => `/list?page=${target}`,
      label: 'Users pages',
    }),
  );
}

describe('Pagination', () => {
  it('renders nothing for a single page', async () => {
    const { container } = await renderPagination(1, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the landmark and summarises the slice', async () => {
    await renderPagination(2, 4);
    expect(screen.getByRole('navigation', { name: 'Users pages' })).toBeInTheDocument();
    expect(screen.getByText('26-50 of 100')).toBeInTheDocument();
  });

  it('shows the first, the last and the neighbours of the current page, with gaps between', async () => {
    await renderPagination(5, 10);
    const names = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label') ?? link.textContent);
    expect(names).toEqual([
      'pagination.previous',
      'Page 1',
      'Page 4',
      'Page 5',
      'Page 6',
      'Page 10',
      'pagination.next',
    ]);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 6' })).toHaveAttribute('href', '/list?page=6');
    expect(screen.getByRole('link', { name: 'pagination.previous' })).toHaveAttribute(
      'href',
      '/list?page=4',
    );
    expect(screen.getByRole('link', { name: 'pagination.next' })).toHaveAttribute(
      'href',
      '/list?page=6',
    );
  });

  it('shows adjacent pages without a gap', async () => {
    await renderPagination(2, 3);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('turns previous into plain text on the first page', async () => {
    await renderPagination(1, 3);
    expect(screen.queryByRole('link', { name: 'pagination.previous' })).not.toBeInTheDocument();
    expect(screen.getByText('pagination.previous')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'pagination.next' })).toBeInTheDocument();
  });

  it('turns next into plain text on the last page', async () => {
    await renderPagination(3, 3);
    expect(screen.queryByRole('link', { name: 'pagination.next' })).not.toBeInTheDocument();
    expect(screen.getByText('pagination.next')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'pagination.previous' })).toBeInTheDocument();
  });
});
