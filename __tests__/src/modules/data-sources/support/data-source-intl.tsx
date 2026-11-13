import type { ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

import messages from '@modules/data-sources/presentation/i18n/en.json';

import app from '@i18n/messages/en.json';

export function DataSourceIntl({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ ...messages, app }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
