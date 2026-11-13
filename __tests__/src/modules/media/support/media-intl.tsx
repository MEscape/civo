import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import type { MediaAssetDto } from '@modules/media/presentation/dto/media-dto';
import enMedia from '@modules/media/presentation/i18n/en.json';

/** The real English texts, for Client Components. */
export function renderInMediaIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMedia} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

/** The modal dialog the test DOM lacks; this is the part of it the components rely on. */
export function installDialogSupport() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

export const WEBSITE_ID = '11111111-1111-4111-8111-111111111111';

export const assetDto = (overrides: Partial<MediaAssetDto> & { id: string }): MediaAssetDto => ({
  originalFilename: `${overrides.id}.png`,
  contentType: 'image/png',
  byteSize: 2048,
  visibility: 'public',
  status: 'ready',
  createdAt: '2026-10-18T10:00:00.000Z',
  publicUrl: `https://media.test/${overrides.id}`,
  ...overrides,
});

export const failure = (code: string) => ({ ok: false, error: { code, message: code } }) as const;

/** Lets a resolved Server Action mock settle inside `act`. */
export const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

export const fileInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]');
