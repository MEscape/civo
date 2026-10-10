import type { Metadata } from 'next';

import { BookingAdministration } from '@modules/booking';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ websiteId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('booking');
  return buildPrivateMetadata(t('admin.title'));
}

export default async function WebsiteBookingsPage({ params }: RouteProps) {
  const { websiteId } = await params;
  const t = await getTranslations('booking');

  return (
    <Container className="max-w-6xl">
      <Section className="space-y-8">
        <PageHeading title={t('admin.title')} description={t('admin.description')} />
        <BookingAdministration websiteId={websiteId} />
      </Section>
    </Container>
  );
}
