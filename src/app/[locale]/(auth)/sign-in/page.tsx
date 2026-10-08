import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { SignInForm, isAuthEnabled, parseSignInPageParams } from '@modules/auth';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: Locale }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildLocalizedMetadata({
    locale,
    pathname: '/sign-in',
    title: t('signIn.metadata.title'),
    description: t('signIn.metadata.description'),
  });
}

export default async function SignInPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  const t = await getTranslations('auth');
  const { returnTo } = parseSignInPageParams(await searchParams);

  return (
    <Container className="max-w-md">
      <Section className="space-y-8">
        <PageHeading title={t('signIn.title')} description={t('signIn.description')} />
        <SignInForm returnTo={returnTo} />
      </Section>
    </Container>
  );
}
