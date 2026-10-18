import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { SignInForm, isAuthEnabled, parseSignInPageParams } from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

import { AuthFormSkeleton } from '@/app/_lib/auth-form-skeleton';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildLocalizedMetadata({
    locale,
    pathname: '/sign-in',
    title: t('signIn.metadata.title'),
    description: t('signIn.metadata.description'),
  });
}

async function SignInContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  const { returnTo } = parseSignInPageParams(await searchParams);

  return <SignInForm returnTo={returnTo} />;
}

export default function SignInPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}
