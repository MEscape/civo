import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  AcceptInvitationForm,
  InvitationLinkMissing,
  isAuthEnabled,
  parseAcceptInvitationPageParams,
} from '@modules/auth';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

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
  return buildPrivateMetadata(t('acceptInvitation.metadata.title'));
}

async function AcceptInvitationContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  const { token } = parseAcceptInvitationPageParams(await searchParams);

  return (
    <Container className="max-w-md">
      <Section className="space-y-8">
        <PageHeading
          title={t('acceptInvitation.title')}
          description={t('acceptInvitation.description')}
        />
        {token === undefined ? <InvitationLinkMissing /> : <AcceptInvitationForm token={token} />}
      </Section>
    </Container>
  );
}

export default function AcceptInvitationPage({ params, searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <AcceptInvitationContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
