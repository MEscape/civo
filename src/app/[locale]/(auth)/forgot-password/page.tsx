import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { ForgotPasswordForm, isAuthEnabled } from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

import { AuthFormSkeleton } from '@/app/_lib/auth-form-skeleton';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildLocalizedMetadata({
    locale,
    pathname: '/forgot-password',
    title: t('forgotPassword.metadata.title'),
    description: t('forgotPassword.metadata.description'),
  });
}

export default function ForgotPasswordPage() {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
