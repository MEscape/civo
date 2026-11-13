import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listMediaAssetsAction } from '@modules/media/presentation/actions/list-media-assets-action';
import { MediaPicker } from '@modules/media/presentation/components/picker/media-picker.client';
import type { MediaAssetDto } from '@modules/media/presentation/dto/media-dto';
import { uploadMediaFile } from '@modules/media/presentation/upload/upload-media-file';

import {
  WEBSITE_ID,
  assetDto,
  fileInput,
  renderInMediaIntl,
  settle,
} from '../../../support/media-intl';

vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@modules/media/presentation/actions/list-media-assets-action', () => ({
  listMediaAssetsAction: vi.fn(),
}));
vi.mock('@modules/media/presentation/upload/upload-media-file', () => ({
  uploadMediaFile: vi.fn(),
}));

const list = vi.mocked(listMediaAssetsAction);
const upload = vi.mocked(uploadMediaFile);

const PUBLIC_A = assetDto({ id: 'a1' });
const PUBLIC_B = assetDto({ id: 'b2' });

const page = (items: MediaAssetDto[], total = items.length) =>
  ({ ok: true, data: { items, page: 1, pageSize: 24, total, pageCount: 1 } }) as const;

const picker = (overrides: Partial<React.ComponentProps<typeof MediaPicker>> = {}) =>
  renderInMediaIntl(
    <MediaPicker websiteId={WEBSITE_ID} value={undefined} onChange={vi.fn()} {...overrides} />,
  );

const chooseFile = async (container: HTMLElement, name = 'photo.png') => {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
  fireEvent.change(fileInput(container)!, { target: { files: [file] } });
  await settle();
  return file;
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue(page([PUBLIC_A, PUBLIC_B]));
});

describe('MediaPicker', () => {
  it('asks for nothing until it is needed', async () => {
    picker();
    await settle();
    expect(list).not.toHaveBeenCalled();
  });

  it("asks only for the named website's newest public images", async () => {
    picker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));
    await screen.findByRole('list', { name: 'Your images' });

    expect(list).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      pageSize: 24,
      visibility: 'public',
    });
  });

  it('hands back only the id of the chosen file, and ends the edit', async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    picker({ onChange, onCommit });
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));
    const grid = await screen.findByRole('list', { name: 'Your images' });
    await waitFor(() => {
      expect(within(grid).getAllByRole('button')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'b2.png' }));

    expect(onChange).toHaveBeenCalledWith('b2');
    expect(onCommit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('list', { name: 'Your images' })).toBeNull();
  });

  it('shows the current choice with a thumbnail, and can clear it', async () => {
    const onChange = vi.fn();
    picker({ value: 'a1', onChange });

    expect(await screen.findByRole('img', { name: 'a1.png' })).toHaveAttribute(
      'src',
      'https://media.test/a1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('says when the website holds more images than the picker shows, and where to find them', async () => {
    list.mockResolvedValue(page([PUBLIC_A, PUBLIC_B], 40));
    picker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Showing the newest 2 of 40 images.',
    );
    expect(screen.getByRole('link', { name: 'Open the media library' })).toHaveAttribute(
      'href',
      `/websites/${WEBSITE_ID}/media`,
    );
  });

  it('stays quiet when every image is shown', async () => {
    picker();
    fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));
    await screen.findByRole('list', { name: 'Your images' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('only accepts the supported image formats in the file dialog', () => {
    const { container } = picker();
    expect(fileInput(container)?.accept).toBe(
      'image/jpeg,image/png,image/webp,image/avif,image/gif',
    );
  });

  it('uploads a public image into the named website and selects it', async () => {
    const onChange = vi.fn();
    upload.mockResolvedValue({ ok: true, asset: assetDto({ id: 'new1' }) });
    const { container } = picker({ onChange });

    const file = await chooseFile(container);

    expect(upload).toHaveBeenCalledWith(WEBSITE_ID, file, 'public');
    expect(onChange).toHaveBeenCalledWith('new1');
  });

  it.each([
    ['media.validation_failed', 'This file cannot be used. Please check it and try again.'],
    [
      'media.client.transfer_failed',
      'The file could not be sent. Check your connection and try again.',
    ],
    [
      'media.too_many_pending',
      'Too many uploads are still in progress. Please wait for them to finish.',
    ],
    ['some.other_module.code', 'Something went wrong. Please try again.'],
  ])(
    'says what went wrong when an upload fails with %s, and selects nothing',
    async (code, message) => {
      const onChange = vi.fn();
      upload.mockResolvedValue({ ok: false, stage: 'request', error: { code, message: code } });
      const { container } = picker({ onChange });

      await chooseFile(container);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(onChange).not.toHaveBeenCalled();
    },
  );
});
