import type { ReactNode } from 'react';

import { render } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';

import enRelease from '@modules/release/presentation/i18n/en.json';

/** What `getTranslations('release')` answers in the tests: the real English texts. */
export function releaseTranslator() {
  return createTranslator({ locale: 'en', messages: enRelease, namespace: 'release' });
}

/** The same texts for Client Components. */
export function renderInReleaseIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enRelease} timeZone="UTC">
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
