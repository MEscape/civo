import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  EmailVerificationResult,
  isAuthEnabled,
  parseEmailVerifiedPageParams,
} from '@modules/auth';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: Locale }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  // Reached only through a single-use emailed link: never indexed.
  return buildPrivateMetadata(t('emailVerification.metadata.title'));
}

export default async function EmailVerifiedPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  const t = await getTranslations('auth');
  const { hasFailed } = parseEmailVerifiedPageParams(await searchParams);

  return (
    <Container className="max-w-md">
      <Section className="space-y-8">
        <PageHeading title={t('emailVerification.title')} />
        <EmailVerificationResult hasFailed={hasFailed} />
      </Section>
    </Container>
  );
}
