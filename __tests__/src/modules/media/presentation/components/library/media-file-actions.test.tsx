import type { ComponentProps } from 'react';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteMediaAssetAction } from '@modules/media/presentation/actions/delete-media-asset-action';
import { getMediaReadUrlAction } from '@modules/media/presentation/actions/get-media-read-url-action';
import { DeleteMediaButton } from '@modules/media/presentation/components/library/delete-media-button.client';
import { OpenMediaButton } from '@modules/media/presentation/components/library/open-media-button.client';

import {
  WEBSITE_ID,
  failure,
  installDialogSupport,
  renderInMediaIntl,
  settle,
} from '../../../support/media-intl';

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
}));
vi.mock('@modules/media/presentation/actions/delete-media-asset-action', () => ({
  deleteMediaAssetAction: vi.fn(),
}));
vi.mock('@modules/media/presentation/actions/get-media-read-url-action', () => ({
  getMediaReadUrlAction: vi.fn(),
}));

const remove = vi.mocked(deleteMediaAssetAction);
const readUrl = vi.mocked(getMediaReadUrlAction);

beforeEach(() => {
  vi.clearAllMocks();
  installDialogSupport();
});

describe('DeleteMediaButton', () => {
  const button = (uses: ComponentProps<typeof DeleteMediaButton>['uses'] = []) =>
    renderInMediaIntl(
      <DeleteMediaButton websiteId={WEBSITE_ID} assetId="a1" filename="town.png" uses={uses} />,
    );

  it('asks before deleting, naming the file, and deletes only after confirmation', async () => {
    remove.mockResolvedValue({ ok: true, data: { id: 'a1' } });
    button();

    fireEvent.click(screen.getByRole('button', { name: 'Delete town.png' }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('“town.png” is removed for good.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }));
    await settle();

    expect(remove).toHaveBeenCalledWith({ websiteId: WEBSITE_ID, id: 'a1' });
  });

  it('lets the person back out of a delete', () => {
    button();
    fireEvent.click(screen.getByRole('button', { name: 'Delete town.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(remove).not.toHaveBeenCalled();
  });

  it('names the components still showing the file instead of offering to delete it', () => {
    button([
      { href: '/websites/w/builder/home?select=n1', label: 'Hero', detail: 'Home' },
      { href: '/websites/w/builder/news?select=n4', label: 'Hero', detail: 'News' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete town.png' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('“town.png” is still in use');
    expect(screen.getByRole('link', { name: /Hero.*News/ })).toHaveAttribute(
      'href',
      '/websites/w/builder/news?select=n4',
    );
    expect(screen.queryByRole('button', { name: 'Delete for good' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open the first one' }));
    expect(navigation.push).toHaveBeenCalledWith('/websites/w/builder/home?select=n1');
    expect(remove).not.toHaveBeenCalled();
  });

  it('warns when the usage is unknown, and still lets the server decide', async () => {
    remove.mockResolvedValue({ ok: true, data: { id: 'a1' } });
    button(null);

    fireEvent.click(screen.getByRole('button', { name: 'Delete town.png' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('could not be checked');
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }));
    await settle();

    expect(remove).toHaveBeenCalledWith({ websiteId: WEBSITE_ID, id: 'a1' });
  });

  it('explains a refusal for a file still in use and re-reads the screen', async () => {
    remove.mockResolvedValue(failure('media.in_use'));
    button();
    fireEvent.click(screen.getByRole('button', { name: 'Delete town.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('in a release that can be restored');
    expect(navigation.refresh).toHaveBeenCalled();
  });
});

describe('OpenMediaButton', () => {
  it('opens a private file through a short-lived link, without handing the page to it', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    readUrl.mockResolvedValue({
      ok: true,
      data: { url: 'https://store.test/signed', expiresAt: '2026-10-18T10:05:00.000Z' },
    });
    renderInMediaIntl(<OpenMediaButton websiteId={WEBSITE_ID} assetId="c3" filename="plan.png" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open plan.png' }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'https://store.test/signed',
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(readUrl).toHaveBeenCalledWith({ websiteId: WEBSITE_ID, id: 'c3' });
  });

  it('says why a link could not be made', async () => {
    readUrl.mockResolvedValue(failure('media.not_ready'));
    renderInMediaIntl(<OpenMediaButton websiteId={WEBSITE_ID} assetId="c3" filename="plan.png" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open plan.png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not ready yet');
  });
});
