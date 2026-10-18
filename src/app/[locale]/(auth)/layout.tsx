import type { ReactNode } from 'react';

import { AuthShell } from '@modules/auth';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

interface AuthLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * The sign-in, invitation and password pages hold forms that are Client
 * Components, so the whole group is given the `auth` texts once, here, instead
 * of each page remembering to. Every page sits in the same shell.
 */
export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <AuthShell locale={locale}>{children}</AuthShell>
    </I18nProvider>
  );
}
