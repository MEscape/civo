import type { ReactNode } from 'react';

import { AuthShell } from '@modules/auth';

import { I18nProvider } from '@components/providers/i18n-provider';
import { JavaScriptRequired } from '@components/shared/javascript-required';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

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
  const app = await getTranslations({ locale, namespace: 'app' });
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <JavaScriptRequired message={app('javascriptRequired')} />
      <AuthShell locale={locale}>{children}</AuthShell>
    </I18nProvider>
  );
}
