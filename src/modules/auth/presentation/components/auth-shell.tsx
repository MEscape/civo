import type { ReactNode } from 'react';

import { ArtemisLogo } from '@components/brand/artemis-logo';

import type { Locale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';

import { AuthAside } from './auth-aside';

export interface AuthShellProps {
  /** The URL's locale: the layout prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  readonly children: ReactNode;
}

/**
 * The page around every sign-in style screen: the brand beside the panel on a
 * wide screen, above it on a phone, and the panel centred in what is left.
 */
export function AuthShell({ locale, children }: AuthShellProps) {
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <AuthAside locale={locale} />
      <div className="flex flex-1 flex-col">
        <div className="flex justify-center px-4 pt-8 text-primary-copy lg:hidden">
          <ArtemisLogo variant="full" className="h-12" title={APP_IDENTITY.company} />
        </div>
        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
