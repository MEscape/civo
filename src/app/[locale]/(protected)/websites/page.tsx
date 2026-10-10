import type { Metadata } from 'next';

import { CreateWebsiteForm, websiteQueries, websiteRoutes } from '@modules/website';

import {
  Container,
  EmptyState,
  Grid,
  PageHeading,
  Section,
} from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.list.title'));
}

export default async function WebsitesPage({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  const websites = await orFail(websiteQueries.listWebsites.execute());

  return (
    <Container className="max-w-4xl">
      <Section className="space-y-8">
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        {websites.length === 0 ? (
          <EmptyState
            title={t('pages.list.empty')}
            description={t('pages.list.emptyDescription')}
          />
        ) : (
          <Grid columns={2} as="ul">
            {websites.map((website) => (
              <li key={website.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Link href={websiteRoutes.detail(website.id)}>{website.name}</Link>
                    </CardTitle>
                    <CardDescription>{website.description ?? website.slug}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </Grid>
        )}

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-copy">
            {t('pages.list.createTitle')}
          </h2>
          <I18nProvider locale={locale} namespaces={['website']}>
            <CreateWebsiteForm />
          </I18nProvider>
        </div>
      </Section>
    </Container>
  );
}
