import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublishButton } from '@modules/release/presentation/components/publication/publish-button';

import { installDialogSupport, renderInReleaseIntl } from '../../../support/release-intl';

const { publishReleaseAction } = vi.hoisted(() => ({ publishReleaseAction: vi.fn() }));

vi.mock('@modules/release/presentation/actions/publish-release-action', () => ({
  publishReleaseAction,
}));

const DRAFT = {
  pageCount: 3,
  blockedPageCount: 0,
  pageChangeCount: 2,
  pageChanges: [
    { path: '', title: 'Home', kind: 'changed' },
    { path: 'booking', title: 'Booking', kind: 'added' },
  ],
  mapChangeCount: 1,
  mapChanges: [{ id: 'm1', name: 'Buildings', kind: 'added' }],
  websiteChanged: false,
  themeChanged: false,
  hasChanges: true,
} as const;

beforeAll(installDialogSupport);
beforeEach(() => {
  publishReleaseAction.mockReset();
});

describe('PublishButton', () => {
  it('reviews what goes live, with the number the release will get', () => {
    renderInReleaseIntl(
      <PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));

    const dialog = screen.getByRole('dialog', { name: 'Publish changes' });
    expect(within(dialog).getByText('Home')).toBeInTheDocument();
    expect(within(dialog).getByText('Booking')).toBeInTheDocument();
    expect(within(dialog).getAllByText('New')).toHaveLength(2);
    // A saved map is listed beside the pages, marked as one, with the same badge.
    expect(within(dialog).getByText('Buildings')).toBeInTheDocument();
    expect(within(dialog).getByText('map')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish as release #3' })).toBeEnabled();
  });

  it('sends the note with the publish', async () => {
    publishReleaseAction.mockResolvedValue({ ok: true, data: { releaseNumber: 3 } });
    renderInReleaseIntl(
      <PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Contact details updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish as release #3' }));

    await waitFor(() => {
      expect(publishReleaseAction).toHaveBeenCalledWith({
        websiteId: 'w1',
        note: 'Contact details updated',
      });
    });
  });

  it('is not offered while a page blocks it', () => {
    renderInReleaseIntl(
      <PublishButton websiteId="w1" draft={DRAFT} nextNumber={3} isFirst={false} disabled />,
    );

    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeDisabled();
  });
});
