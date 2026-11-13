import { notFound } from 'next/navigation';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';
import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { BackLink } from '@components/shared/page-parts.client';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNotFound } from '@lib/errors/or-not-found';

import { getAuthQueries, isAuthEnabled } from '../../../composition';
import { authRoutes, DEFAULT_RETURN_PATH } from '../../routes';

import { ProfileForm } from './profile-form.client';

/** The authenticated person's settings, without website role requirements or editable identity identifiers. */
export async function ProfileAdministration({ locale }: { readonly locale: Locale }) {
  if (!isAuthEnabled) {
    notFound();
  }
  const [profile, t, format] = await Promise.all([
    orNotFound(getAuthQueries().getOwnProfile.execute()),
    getTranslations({ locale, namespace: 'auth' }),
    getAppFormatters(),
  ]);
  return (
    <AdminPage>
      <AdminPageHeader
        title={t('profile.title')}
        description={t('profile.description')}
        back={<BackLink label={t('profile.back')} fallbackHref={DEFAULT_RETURN_PATH} />}
      />
      <I18nProvider locale={locale} namespaces={['auth']}>
        <UnsavedChangesProvider
          title={t('profile.unsavedTitle')}
          description={t('profile.unsavedDescription')}
          confirmLabel={t('profile.discard')}
          cancelLabel={t('profile.keepEditing')}
        >
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ProfileForm profile={profile} />
            <DataPanel title={t('profile.accountTitle')}>
              <DataPanelBody>
                <dl className="space-y-5 text-sm">
                  <div className="space-y-1">
                    <dt className="text-xs text-copy-muted">{t('profile.email')}</dt>
                    <dd className="break-all">{profile.email}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-copy-muted">{t('profile.emailStatus')}</dt>
                    <dd>
                      <Badge variant={profile.emailVerified ? 'success' : 'warning'}>
                        {t(profile.emailVerified ? 'profile.verified' : 'profile.unverified')}
                      </Badge>
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-copy-muted">{t('profile.memberSince')}</dt>
                    <dd>
                      <time dateTime={profile.createdAt.toISOString()}>
                        {format.date(profile.createdAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
              </DataPanelBody>
              <DataPanelFooter>
                <Link
                  href={authRoutes.forgotPassword()}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  {t('profile.resetPassword')}
                </Link>
              </DataPanelFooter>
            </DataPanel>
          </div>
        </UnsavedChangesProvider>
      </I18nProvider>
    </AdminPage>
  );
}
