import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

/**
 * Shown instead of the form when the page was opened without a usable token
 * (an incomplete link, or a hand-typed URL). A Server Component.
 */
export async function InvitationLinkMissing() {
  const t = await getTranslations('auth');

  return (
    <StatusNotice title={t('acceptInvitation.missingTokenTitle')}>
      <p>{t('acceptInvitation.missingToken')}</p>
      <AuthLink href={authRoutes.signIn()}>{t('acceptInvitation.signInLink')}</AuthLink>
    </StatusNotice>
  );
}
