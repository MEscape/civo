import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { isAuthEnabled, requireSignedIn, SignOutButton } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { AppHeader, PageShell } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';

/**
 * Reading the session is runtime data, and a segment's `loading.tsx` wraps
 * its page but not the layout beside it, so the check runs under its own
 * boundary. The fallback is empty on purpose: pages stream their own parts.
 * This is navigation convenience; every query authorizes for itself.
 */
async function SignedInGate({ children }: { readonly children: ReactNode }) {
  await requireSignedIn();
  return children;
}

/** The admin area's frame: the way back to the website list, and signing out when there is a session to end. */
async function ProtectedHeader({ locale }: { readonly locale: Locale }) {
  const [app, website] = await Promise.all([
    getTranslations({ locale, namespace: 'app' }),
    getTranslations({ locale, namespace: 'website' }),
  ]);

  return (
    <AppHeader className="justify-between gap-4">
      <AppNav
        label={app('navigation.label')}
        links={[
          { href: websiteRoutes.list(), label: APP_IDENTITY.name, isBrand: true },
          { href: websiteRoutes.list(), label: website('pages.list.title') },
        ]}
      />
      {isAuthEnabled && (
        <I18nProvider locale={locale} namespaces={['auth']}>
          <SignOutButton />
        </I18nProvider>
      )}
    </AppHeader>
  );
}

export default async function ProtectedLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}) {
  // Segments prerender on their own, so the locale comes from the URL rather than the request.
  const locale = requireLocale((await params).locale);

  return (
    <PageShell>
      <ProtectedHeader locale={locale} />
      <Suspense fallback={null}>
        <SignedInGate>{children}</SignedInGate>
      </Suspense>
    </PageShell>
  );
}
