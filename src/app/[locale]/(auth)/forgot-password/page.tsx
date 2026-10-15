import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { ForgotPasswordForm, isAuthEnabled } from '@modules/auth';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

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

async function ForgotPasswordContent({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <Container className="max-w-md">
      <Section className="space-y-8">
        <PageHeading
          title={t('forgotPassword.title')}
          description={t('forgotPassword.description')}
        />
        <ForgotPasswordForm />
      </Section>
    </Container>
  );
}

export default function ForgotPasswordPage({ params }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ForgotPasswordContent params={params} />
    </Suspense>
  );
}
