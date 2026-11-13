import type { ComponentProps } from 'react';

import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { MediaAssetView } from '@modules/media/application/contracts/media-views';
import { mediaFileColumns } from '@modules/media/presentation/components/library/media-file-columns';
import enMedia from '@modules/media/presentation/i18n/en.json';

import { ResponsiveTable } from '@components/shared/responsive-table';

import { createAppFormatters } from '@i18n/formatters';

import { WEBSITE_ID, installDialogSupport, renderInMediaIntl } from '../../../support/media-intl';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@modules/media/presentation/actions/delete-media-asset-action', () => ({
  deleteMediaAssetAction: vi.fn(),
}));
vi.mock('@modules/media/presentation/actions/get-media-read-url-action', () => ({
  getMediaReadUrlAction: vi.fn(),
}));

const view = (overrides: Partial<MediaAssetView> & { id: string }): MediaAssetView => ({
  originalFilename: `${overrides.id}.png`,
  contentType: 'image/png',
  byteSize: 2048,
  visibility: 'public',
  status: 'ready',
  createdAt: new Date('2026-10-18T10:00:00.000Z'),
  publicUrl: `https://media.test/${overrides.id}`,
  ...overrides,
});
const PUBLIC = view({ id: 'a1' });
const PRIVATE = view({ id: 'c3', visibility: 'private', publicUrl: null });

function table(mayDelete: boolean) {
  installDialogSupport();
  const t = createTranslator({ locale: 'en', messages: enMedia, namespace: 'media' });
  return renderInMediaIntl(
    <ResponsiveTable
      label="Files"
      rows={[PUBLIC, PRIVATE]}
      rowKey={(asset) => asset.id}
      columns={mediaFileColumns({
        t,
        format: createAppFormatters('en', 'UTC'),
        websiteId: WEBSITE_ID,
        mayDelete,
        usage: null,
        sort: { field: 'uploaded', direction: 'desc' },
        sortHref: (field) => `/media?sort=${field}`,
      })}
      state={{ kind: 'ready', empty: null }}
    />,
  );
}

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByText(name).closest<HTMLElement>('[role="row"]');
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

describe('mediaFileColumns', () => {
  it('previews a public file and marks it public', () => {
    const { container } = table(true);
    const row = rowOf('a1.png');

    expect(within(row).getByText('Public')).toBeInTheDocument();
    expect(row.querySelector('img')).toHaveAttribute('src', 'https://media.test/a1');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('shows a private file without an address, and only it offers "Open"', () => {
    table(true);
    const row = rowOf('c3.png');

    expect(within(row).getByText('Private')).toBeInTheDocument();
    expect(row.querySelector('img')).toBeNull();
    expect(within(row).getByRole('button', { name: 'Open c3.png' })).toBeInTheDocument();
    expect(within(rowOf('a1.png')).queryByRole('button', { name: /^Open/ })).toBeNull();
  });

  it("says what kind and how big, and when it arrived, in the reader's locale", () => {
    table(true);
    expect(within(rowOf('a1.png')).getByText('PNG · 2 kB')).toBeInTheDocument();
    expect(within(rowOf('a1.png')).getByText(/Oct 18, 2026/)).toBeInTheDocument();
  });

  it('sorts by name and by upload date from the column headings, marking the current one', () => {
    table(true);

    expect(screen.getAllByRole('link', { name: 'File' })[0]).toHaveAttribute(
      'href',
      '/media?sort=name',
    );
    expect(screen.getAllByRole('link', { name: 'Uploaded' })[0]).toHaveAttribute(
      'href',
      '/media?sort=uploaded',
    );
    expect(screen.getByRole('columnheader', { name: 'Uploaded' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('offers delete only to a person who may delete', () => {
    const { unmount } = table(true);
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(2);
    unmount();

    table(false);
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });
});
