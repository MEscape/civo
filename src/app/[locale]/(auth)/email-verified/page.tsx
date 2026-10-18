import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  EmailVerificationResult,
  isAuthEnabled,
  parseEmailVerifiedPageParams,
} from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { AuthFormSkeleton } from '@/app/_lib/auth-form-skeleton';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  // Reached only through a single-use emailed link: never indexed.
  return buildPrivateMetadata(t('emailVerification.metadata.title'));
}

async function EmailVerifiedContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  const { hasFailed } = parseEmailVerifiedPageParams(await searchParams);

  return <EmailVerificationResult hasFailed={hasFailed} />;
}

export default function EmailVerifiedPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <EmailVerifiedContent searchParams={searchParams} />
    </Suspense>
  );
}
