import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  ResetPasswordForm,
  ResetPasswordLinkMissing,
  isAuthEnabled,
  parseResetPasswordPageParams,
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
  return buildPrivateMetadata(t('resetPassword.metadata.title'));
}

async function ResetPasswordContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  const { token } = parseResetPasswordPageParams(await searchParams);

  return token === undefined ? <ResetPasswordLinkMissing /> : <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
