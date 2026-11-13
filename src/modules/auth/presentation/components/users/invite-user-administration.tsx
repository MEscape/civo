import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNotFound } from '@lib/errors/or-not-found';

import { getAuthQueries, getHeldPermissions } from '../../../composition';
import { invitePageParamsSchema } from '../../schemas/invite-user-form-schema';

import { InviteUserForm } from './invite-user-form.client';

export interface InviteUserAdministrationProps {
  readonly locale: Locale;
  /** Inside one website (already authorized by the route), or across the websites the viewer manages. */
  readonly scope:
    { readonly kind: 'website'; readonly websiteId: string } | { readonly kind: 'global' };
  /** The users list this page belongs to: the breadcrumb, cancel, and where a sent invitation returns. */
  readonly listHref: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
}

/** Reads the websites a cross-website invitation may target; a person who manages none gets "not found". */
async function readTargets(scope: InviteUserAdministrationProps['scope']) {
  if (scope.kind === 'website') {
    return {
      websites: undefined,
      isTruncated: false,
      canInvitePlatformAdmin: false,
      descriptionKey: 'users.invite.websiteDescription',
    } as const;
  }
  const [options, held] = await Promise.all([
    getAuthQueries().listManageableWebsites.execute(),
    getHeldPermissions(['platform.admin.manage']),
  ]);
  const { websites, isTruncated } = orNotFound(options);
  // Only decides whether the choice is offered; the server authorizes the invitation itself.
  const canInvitePlatformAdmin = held.has('platform.admin.manage');
  return {
    websites,
    isTruncated,
    canInvitePlatformAdmin,
    descriptionKey: canInvitePlatformAdmin
      ? 'users.invite.description'
      : 'users.invite.websitesDescription',
  } as const;
}

/** The page that invites one person: a wizard from the address over the access to a last look. */
export async function InviteUserAdministration({
  locale,
  scope,
  listHref,
  searchParams,
}: InviteUserAdministrationProps) {
  const params = invitePageParamsSchema.parse(searchParams);
  const [t, targets] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    readTargets(scope),
  ]);

  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['auth']}>
        <AdminPageHeader
          title={t('users.invite.title')}
          description={t(targets.descriptionKey)}
          breadcrumbLabel={t('users.navigation.breadcrumb')}
          crumbs={[
            {
              label: t(scope.kind === 'website' ? 'users.title' : 'users.global.title'),
              href: listHref,
            },
            { label: t('users.invite.title') },
          ]}
        />
        {targets.isTruncated && (
          <Alert variant="warning" role="status">
            {t('users.websites.truncated')}
          </Alert>
        )}
        <UnsavedChangesProvider
          title={t('users.invite.unsavedTitle')}
          description={t('users.invite.unsavedDescription')}
          confirmLabel={t('users.access.discard')}
          cancelLabel={t('users.access.keepEditing')}
        >
          <InviteUserForm
            step={params.step}
            listHref={listHref}
            initialRole={params.role ?? 'viewer'}
            initialTenantId={scope.kind === 'website' ? scope.websiteId : undefined}
            websites={targets.websites}
            canInvitePlatformAdmin={targets.canInvitePlatformAdmin}
          />
        </UnsavedChangesProvider>
      </I18nProvider>
    </AdminPage>
  );
}
