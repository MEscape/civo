import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RestoreReleaseButton } from '@modules/release/presentation/components/releases/restore-release-button';

import { installDialogSupport, renderInReleaseIntl } from '../../../support/release-intl';

const { rollbackReleaseAction } = vi.hoisted(() => ({ rollbackReleaseAction: vi.fn() }));

vi.mock('@modules/release/presentation/actions/rollback-release-action', () => ({
  rollbackReleaseAction,
}));
vi.mock('@i18n/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppFormatters: () => ({ dateTime: (value: string) => value }),
}));

const renderButton = () =>
  renderInReleaseIntl(
    <RestoreReleaseButton
      websiteId="w1"
      releaseId="r1"
      releaseNumber={1}
      publishedAt="2026-10-11T10:00:00.000Z"
    />,
  );

beforeAll(installDialogSupport);
beforeEach(() => {
  rollbackReleaseAction.mockReset();
});

describe('RestoreReleaseButton', () => {
  it('asks before restoring, and only then restores', async () => {
    rollbackReleaseAction.mockResolvedValue({ ok: true, data: { releaseNumber: 1 } });
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Restore release #1' }));
    expect(rollbackReleaseAction).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: 'Restore release #1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(rollbackReleaseAction).toHaveBeenCalledWith({ websiteId: 'w1', releaseId: 'r1' });
    });
    expect(await screen.findByText('Release #1 is live again.')).toBeInTheDocument();
  });

  it('keeps everything as it is when the question is cancelled', () => {
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Restore release #1' }));
    const dialog = screen.getByRole('dialog', { name: 'Restore release #1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(rollbackReleaseAction).not.toHaveBeenCalled();
  });

  it('says why a restore failed', async () => {
    rollbackReleaseAction.mockResolvedValue({
      ok: false,
      error: { code: 'release.not_restorable', message: 'no' },
    });
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Restore release #1' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Restore release #1?' })).getByRole('button', {
        name: 'Restore',
      }),
    );

    expect(
      await screen.findByText(
        'This release was never published successfully and cannot be restored.',
      ),
    ).toBeInTheDocument();
  });
});
