import type { Metadata } from 'next';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app.metadata' });

  return buildLocalizedMetadata({
    locale,
    pathname: '',
    title: t('title'),
    description: t('description'),
  });
}

export default async function LocaleRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app.home' });

  return (
    <Container className="max-w-4xl">
      <Section className="mt-12 space-y-8 text-center">
        <PageHeading title={t('title')} description={t('description')} />
        <p className="text-copy-muted">{t('comingSoon')}</p>
      </Section>
    </Container>
  );
}
