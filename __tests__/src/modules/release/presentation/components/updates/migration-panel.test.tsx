import type { ReactNode } from 'react';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationPanel } from '@modules/release/presentation/components/updates/migration-panel';

import { renderInReleaseIntl } from '../../../support/release-intl';

const { proposeMigrationAction } = vi.hoisted(() => ({ proposeMigrationAction: vi.fn() }));

vi.mock('@modules/release/presentation/actions/propose-migration-action', () => ({
  proposeMigrationAction,
}));
vi.mock('@modules/release/presentation/actions/apply-migration-action', () => ({
  applyMigrationAction: vi.fn(),
}));
vi.mock('@i18n', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({ date: (value: string) => value }),
}));

const renderPanel = (canReview: boolean, children: ReactNode = <p>idle state</p>) =>
  renderInReleaseIntl(
    <MigrationPanel websiteId="w1" canReview={canReview} checkedAt="2026-10-15T10:42:00.000Z">
      {children}
    </MigrationPanel>,
  );

beforeEach(() => {
  proposeMigrationAction.mockReset();
});

describe('MigrationPanel', () => {
  it('shows the state it is given, when it was checked, and a quiet way to check again', () => {
    renderPanel(true);

    expect(screen.getByText('idle state')).toBeInTheDocument();
    expect(screen.getByText(/Checked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeInTheDocument();
  });

  it('offers a review to someone who may run one when something is waiting', () => {
    renderPanel(true);

    expect(screen.getByRole('button', { name: 'Review changes' })).toBeInTheDocument();
  });

  it('does not offer a review to someone who may not, or when nothing is waiting', () => {
    renderPanel(false);

    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull();
    expect(screen.getByText('idle state')).toBeInTheDocument();
  });

  it('says so when the website is already up to date after all', async () => {
    proposeMigrationAction.mockResolvedValue({
      ok: true,
      data: {
        migrationId: null,
        sourceReleaseId: 'r1',
        plan: {
          pages: [],
          counts: { unchanged: 3, upgradable: 0, needs_review: 0, unresolvable: 0 },
          requiresReview: false,
          isUpToDate: true,
        },
      },
    });
    renderPanel(true);

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));

    expect(await screen.findByText('All components are up to date')).toBeInTheDocument();
    expect(screen.queryByText('idle state')).toBeNull();
    expect(proposeMigrationAction).toHaveBeenCalledWith({ websiteId: 'w1' });
  });

  it('says why a proposal failed and keeps the state', async () => {
    proposeMigrationAction.mockResolvedValue({
      ok: false,
      error: { code: 'release.not_published', message: 'no' },
    });
    renderPanel(true);

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));

    await waitFor(() => {
      expect(screen.getByText('idle state')).toBeInTheDocument();
    });
    expect(await screen.findByText('This website has not been published yet.')).toBeInTheDocument();
  });
});
