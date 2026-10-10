import type { Metadata } from 'next';

import { BookingAdministration } from '@modules/booking';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('admin.title'));
}

export default async function WebsiteBookingsPage({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const { websiteId } = await params;
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <Container className="max-w-6xl">
      <Section className="space-y-8">
        <PageHeading title={t('admin.title')} description={t('admin.description')} />
        <BookingAdministration websiteId={websiteId} locale={locale} />
      </Section>
    </Container>
  );
}
