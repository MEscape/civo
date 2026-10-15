import { notFound } from 'next/navigation';

import { getMemberTenantIds } from '@modules/auth';
import { websiteQueries, websiteRoutes } from '@modules/website';

import { AdminContainer, Grid, PageHeading, Section } from '@components/layout/layout-primitives';
import { LinkCard } from '@components/shared/link-card';

import { redirect } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orFail } from './or-fail';

export interface MemberWebsitesProps {
  readonly locale: Locale;
  /** Where the tenant the person is working in sends them. */
  readonly landing: string | null;
}

/**
 * What someone who is not a platform administrator sees at `/websites`: the
 * websites they belong to. With one, they start there; with several, they
 * choose, and each choice is an address (`/websites/<id>`), which is also how
 * the tenant they work in is chosen. With none there is nothing here.
 */
export async function MemberWebsites({ locale, landing }: MemberWebsitesProps) {
  const tenantIds = await getMemberTenantIds();
  if (tenantIds.length === 0) {
    return notFound();
  }
  if (tenantIds.length === 1 && landing !== null) {
    return redirect({ href: landing, locale });
  }

  const [names, t] = await Promise.all([
    orFail(websiteQueries.listWebsiteNames.execute(tenantIds)),
    getTranslations({ locale, namespace: 'website' }),
  ]);

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading
          title={t('pages.list.title')}
          description={t('pages.list.memberDescription')}
        />
        <Grid columns={2} as="ul">
          {names.map((website) => (
            <li key={website.id}>
              <LinkCard
                href={websiteRoutes.detail(website.id)}
                title={website.name}
                description=""
              />
            </li>
          ))}
        </Grid>
      </Section>
    </AdminContainer>
  );
}
