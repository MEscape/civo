import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUploadButton } from '@modules/media/presentation/components/library/media-upload-button.client';
import { MediaUploadNotice } from '@modules/media/presentation/components/library/media-upload-notice.client';
import { MediaUploadScope } from '@modules/media/presentation/components/library/media-upload-scope.client';
import { uploadMediaFile } from '@modules/media/presentation/upload/upload-media-file';

import {
  WEBSITE_ID,
  assetDto,
  fileInput,
  installDialogSupport,
  renderInMediaIntl,
} from '../../../support/media-intl';

vi.mock('@modules/media/presentation/upload/upload-media-file', () => ({
  uploadMediaFile: vi.fn(),
}));

const upload = vi.mocked(uploadMediaFile);

const files = () => [
  new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }),
  new File([new Uint8Array([1])], 'b.png', { type: 'image/png' }),
];

function screenWithUpload() {
  const view = renderInMediaIntl(
    <MediaUploadScope websiteId={WEBSITE_ID}>
      <MediaUploadButton />
      <MediaUploadNotice />
    </MediaUploadScope>,
  );
  const choose = () => {
    fireEvent.change(fileInput(view.container)!, { target: { files: files() } });
  };
  return { ...view, choose };
}

beforeEach(() => {
  vi.clearAllMocks();
  installDialogSupport();
});

describe('MediaUploadScope', () => {
  it('opens the file chooser from the main action', () => {
    const { container } = screenWithUpload();
    const click = vi.spyOn(fileInput(container)!, 'click');

    fireEvent.click(screen.getByRole('button', { name: 'Upload images' }));

    expect(click).toHaveBeenCalled();
  });

  it('shows the chosen files before sending anything, and sends nothing on cancel', () => {
    const { choose } = screenWithUpload();
    choose();

    expect(screen.getByRole('dialog')).toHaveTextContent('2 images are uploaded');
    expect(screen.getByRole('list', { name: 'Chosen files' })).toHaveTextContent('a.pngb.png');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads into the named website, publicly by default, and says how many arrived', async () => {
    upload.mockResolvedValue({ ok: true, asset: assetDto({ id: 'n' }) });
    const { choose } = screenWithUpload();
    choose();

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(await screen.findByText('2 images uploaded.')).toBeInTheDocument();
    expect(upload.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      [WEBSITE_ID, 'public'],
      [WEBSITE_ID, 'public'],
    ]);
  });

  it('uploads private when asked to', async () => {
    upload.mockResolvedValue({ ok: true, asset: assetDto({ id: 'n' }) });
    const { choose } = screenWithUpload();
    choose();

    fireEvent.click(screen.getByRole('checkbox', { name: /Keep private/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
    });
    expect(upload.mock.calls.map((call) => call[2])).toEqual(['private', 'private']);
  });

  it('stops at the first upload that fails and says why', async () => {
    upload
      .mockResolvedValueOnce({
        ok: false,
        stage: 'request',
        error: { code: 'media.validation_failed', message: 'x' },
      })
      .mockResolvedValue({ ok: true, asset: assetDto({ id: 'n' }) });
    const { choose } = screenWithUpload();
    choose();

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be used');
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('accepts several files and only the supported image formats', () => {
    const { container } = screenWithUpload();
    expect(fileInput(container)).toHaveAttribute('multiple');
    expect(fileInput(container)?.accept).toBe(
      'image/jpeg,image/png,image/webp,image/avif,image/gif',
    );
  });
});
