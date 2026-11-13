import type { ReactNode } from 'react';

import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ReleaseHistoryTable } from '@modules/release/presentation/components/releases/release-history-table';
import type { ReleaseHistoryTableProps } from '@modules/release/presentation/components/releases/release-history-table';

import {
  AUTHORS,
  EARLIER_RELEASE,
  LIVE_RELEASE,
  historyOf,
} from '../../../support/release-fixtures';
import { installDialogSupport, renderInReleaseIntl } from '../../../support/release-intl';

vi.mock('@modules/release/presentation/actions/rollback-release-action', () => ({
  rollbackReleaseAction: vi.fn(),
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () => (await import('../../../support/release-intl')).releaseTranslator(),
  getAppFormatters: async () => ({ dateTime: (value: Date) => value.toISOString() }),
}));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({ dateTime: (value: string) => value }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@components/shared/pagination', () => ({
  Pagination: ({ hrefFor, label }: { hrefFor: (page: number) => string; label: string }) => (
    <nav aria-label={label}>
      <a href={hrefFor(2)}>next page</a>
    </nav>
  ),
}));

const base: ReleaseHistoryTableProps = {
  locale: 'en',
  websiteId: 'w1',
  history: historyOf(),
  authors: AUTHORS,
  mayRollback: false,
  hrefFor: (page) => `/websites/w1/releases?page=${page}`,
};

async function renderTable(props: Partial<ReleaseHistoryTableProps> = {}) {
  return renderInReleaseIntl(await ReleaseHistoryTable({ ...base, ...props }));
}

beforeAll(installDialogSupport);

describe('ReleaseHistoryTable', () => {
  it('shows each release with its note, date and what it changed', async () => {
    await renderTable();

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveTextContent('Release #2');
    expect(live).toHaveTextContent('Live');
    expect(live).toHaveTextContent('Contact page reworked');
    expect(live).toHaveTextContent('2 pages');
    expect(live).toHaveTextContent('EditedHome');
    expect(live).toHaveTextContent('NewBooking');
    expect(earlier).toHaveTextContent('Release #1');
    expect(earlier).not.toHaveTextContent('Live');
    expect(earlier).toHaveTextContent('No details kept');
  });

  it('says how many changed pages the row does not list', async () => {
    const changes = { ...LIVE_RELEASE.changes!, pageChangeCount: 12 };
    await renderTable({ history: historyOf([{ ...LIVE_RELEASE, changes }]) });

    expect(screen.getByText('+10 more')).toBeInTheDocument();
  });

  it('lets a reader preview a release while retaining the current history slice', async () => {
    await renderTable({
      history: historyOf(undefined, { total: 120, request: { page: 3, pageSize: 50 } }),
    });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Preview release #1' })).toHaveAttribute(
      'href',
      '/websites/w1/releases/r1/preview?from=3&fromPageSize=50',
    );
  });

  it('says who published, when the person can be named', async () => {
    await renderTable();

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveTextContent('Published by Anna Müller');
    expect(earlier).not.toHaveTextContent('Anna');
  });

  it('says a former member published when the id has no name any more', async () => {
    await renderTable({
      history: historyOf([LIVE_RELEASE, { ...EARLIER_RELEASE, publishedBy: 'actor-gone' }]),
    });

    expect(screen.getAllByRole('row')[2]).toHaveTextContent('Published by a former member');
  });

  it('says nothing about who published when accounts cannot be named at all', async () => {
    await renderTable({ authors: null });

    expect(screen.queryByText(/Published by/)).toBeNull();
  });

  it('tints the live release and names a rolled back one so it can be read', async () => {
    await renderTable({
      history: historyOf([LIVE_RELEASE, { ...EARLIER_RELEASE, status: 'rolled_back' }]),
    });

    const [, live, earlier] = screen.getAllByRole('row');
    expect(live).toHaveClass('bg-success-subtle/40');
    expect(live).toHaveAttribute('aria-current', 'true');
    expect(earlier).toHaveTextContent('Rolled back');
  });

  it('counts the releases', async () => {
    await renderTable();

    expect(screen.getByText('2 releases')).toBeInTheDocument();
  });

  it('offers to restore only a release that can be restored, and only to someone who may', async () => {
    await renderTable({ mayRollback: true });

    expect(screen.getAllByRole('button', { name: /Restore release/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restore release #1' })).toBeInTheDocument();
    expect(screen.getByText(/Restoring a release reactivates/)).toBeInTheDocument();
  });

  it('shows no restore control to someone who may not roll back', async () => {
    await renderTable({ mayRollback: false });

    expect(screen.queryByRole('button', { name: /Restore/ })).toBeNull();
    expect(screen.queryByText(/Restoring a release reactivates/)).toBeNull();
  });

  it('draws the page links in the footer only when there is more than one page', async () => {
    await renderTable();
    expect(screen.queryByRole('navigation', { name: 'Release pages' })).toBeNull();
  });

  it('links the pages of a longer history', async () => {
    await renderTable({ history: historyOf(undefined, { total: 25 }) });

    expect(screen.getByRole('link', { name: 'next page' })).toHaveAttribute(
      'href',
      '/websites/w1/releases?page=2',
    );
  });

  it('explains an empty history', async () => {
    await renderTable({ history: historyOf([], { total: 0 }) });

    expect(screen.getByText('No releases published yet')).toBeInTheDocument();
  });
});
