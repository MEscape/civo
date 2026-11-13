import type { ReactNode } from 'react';

import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MigrationSummaryView } from '@modules/release/application/contracts/migration-views';
import type { PublicationStatusView } from '@modules/release/application/contracts/publication-views';
import { ComponentUpdates } from '@modules/release/presentation/components/updates/component-updates';

import { toPage } from '@lib/pagination';

import { resolveServerComponents } from '../../../../../support/server-components';
import { renderInReleaseIntl } from '../../../support/release-intl';

vi.mock('@modules/release/presentation/actions/propose-migration-action', () => ({
  proposeMigrationAction: vi.fn(),
}));
vi.mock('@modules/release/presentation/actions/apply-migration-action', () => ({
  applyMigrationAction: vi.fn(),
}));
vi.mock('@i18n', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@i18n/server', () => ({
  getTranslations: async () => (await import('../../../support/release-intl')).releaseTranslator(),
  getAppFormatters: async () => ({ date: () => '2026-10-15', dateTime: () => '2026-10-15 10:00' }),
}));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({ date: (value: string) => value }),
}));
vi.mock('@components/shared/pagination', () => ({ Pagination: () => null }));

const HISTORY = toPage<MigrationSummaryView>([], 0, { page: 1, pageSize: 10 });

const statusOf = (
  componentUpdates: PublicationStatusView['componentUpdates'],
): PublicationStatusView =>
  ({
    checkedAt: new Date('2026-10-15T10:42:00.000Z'),
    componentUpdates,
  }) as PublicationStatusView;

const AVAILABLE: NonNullable<PublicationStatusView['componentUpdates']> = {
  available: 2,
  needReview: 1,
  unresolvable: 0,
  components: [
    {
      type: 'hero',
      fromVersion: 1,
      toVersion: 2,
      usageCount: 1,
      pageCount: 1,
      pagePaths: [''],
      status: 'needs_review',
      addedFields: [],
      conflictFields: ['title'],
    },
    {
      type: 'serviceGrid',
      fromVersion: 3,
      toVersion: 4,
      usageCount: 2,
      pageCount: 2,
      pagePaths: ['', 'services'],
      status: 'upgradable',
      addedFields: [],
      conflictFields: [],
    },
  ],
};

async function renderUpdates(
  updates: PublicationStatusView['componentUpdates'],
  mayRun: boolean,
): Promise<void> {
  const element: ReactNode = await ComponentUpdates({
    locale: 'en',
    websiteId: 'w1',
    history: HISTORY,
    status: statusOf(updates),
    mayRun,
    hrefFor: (page) => `?tab=updates&page=${page}`,
  });
  renderInReleaseIntl(await resolveServerComponents(element));
}

describe('ComponentUpdates', () => {
  it('explains the way updates go as steps, not as a sentence', async () => {
    await renderUpdates(AVAILABLE, true);

    const steps = screen.getByRole('list', { name: 'How component updates work' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
  });

  it('counts what can be updated and offers the review', async () => {
    await renderUpdates(AVAILABLE, true);

    expect(screen.getByText('2 updates available')).toBeInTheDocument();
    expect(screen.getByText('1 compatible')).toBeInTheDocument();
    expect(screen.getByText('1 need review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review changes' })).toBeInTheDocument();
  });

  it('does not offer the review to someone who may not run migrations', async () => {
    await renderUpdates(AVAILABLE, false);

    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.getByText('2 updates available')).toBeInTheDocument();
  });

  it('calls everything up to date only when nothing is left, and offers no review then', async () => {
    await renderUpdates({ available: 0, needReview: 0, unresolvable: 0, components: [] }, true);

    expect(screen.getByText('All components are up to date')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });

  it('does not call components up to date when some cannot be updated at all', async () => {
    await renderUpdates(
      {
        available: 0,
        needReview: 0,
        unresolvable: 1,
        components: [
          {
            type: 'hero',
            fromVersion: 9,
            toVersion: null,
            usageCount: 1,
            pageCount: 1,
            pagePaths: [''],
            status: 'unresolvable',
            addedFields: [],
            conflictFields: [],
          },
        ],
      },
      true,
    );

    expect(screen.getByText('1 component cannot be updated')).toBeInTheDocument();
    expect(screen.queryByText('All components are up to date')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });

  it('asks for a first release before there is anything to check', async () => {
    await renderUpdates(null, true);

    expect(screen.getByText(/Publish your website first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
  });

  it('draws the history of earlier updates below the state', async () => {
    await renderUpdates(AVAILABLE, true);

    expect(screen.getByText('No updates have been proposed yet.')).toBeInTheDocument();
  });
});
