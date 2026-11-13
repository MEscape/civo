import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { AccountNavigation, isAuthEnabled, requireSignedIn } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { AppBrand } from '@components/brand/app-brand';
import { AppHeader, PageShell } from '@components/layout/layout-primitives';
import { RefreshOnFocus } from '@components/providers/refresh-on-focus';
import { JavaScriptRequired } from '@components/shared/javascript-required';
import { LoadingStatus } from '@components/shared/page-parts.client';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';

/**
 * Reading the session is runtime data, and a segment's `loading.tsx` wraps
 * its page but not the layout beside it, so the check runs under its own
 * boundary. Its fallback announces loading; page boundaries supply their own screen skeletons.
 * This is navigation convenience; every query authorizes for itself.
 */
async function SignedInGate({ children }: { readonly children: ReactNode }) {
  await requireSignedIn();
  return (
    <>
      <RefreshOnFocus />
      {children}
    </>
  );
}

/**
 * The admin area's frame: the brand, which leads back to the website list, and the authenticated account menu.
 * Nothing else lives here: each area has its own bar below (a website, the booking workspace), and the
 * way between them is in those bars.
 */
async function ProtectedHeader({ locale }: { readonly locale: Locale }) {
  const app = await getTranslations({ locale, namespace: 'app' });

  return (
    <AppHeader className="justify-between gap-4">
      <AppBrand
        href={websiteRoutes.list()}
        byline={app('brand.byline', { company: APP_IDENTITY.company })}
      />
      {isAuthEnabled && (
        <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
          <AccountNavigation locale={locale} />
        </Suspense>
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
  const app = await getTranslations({ locale, namespace: 'app' });

  return (
    <PageShell>
      <ProtectedHeader locale={locale} />
      <main className="flex min-h-0 flex-1 flex-col">
        <JavaScriptRequired message={app('javascriptRequired')} />
        <Suspense fallback={<LoadingStatus />}>
          <SignedInGate>{children}</SignedInGate>
        </Suspense>
      </main>
    </PageShell>
  );
}
