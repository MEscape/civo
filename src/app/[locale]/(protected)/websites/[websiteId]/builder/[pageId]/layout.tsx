import type { ReactNode } from 'react';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

/**
 * The editor's Client Components read `builder` text and, through
 * `useComponentText`, the platform components' labels (`componentPlatform`).
 * Only this subtree receives those namespaces.
 */
export default async function BuilderLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['builder', 'componentPlatform']}>
      {children}
    </I18nProvider>
  );
}
