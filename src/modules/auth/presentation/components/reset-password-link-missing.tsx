import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

/**
 * Shown instead of the reset form when the page was opened without a usable
 * token (an incomplete link, or a hand-typed URL). A Server Component.
 */
export async function ResetPasswordLinkMissing() {
  const t = await getTranslations('auth');

  return (
    <StatusNotice title={t('resetPassword.missingTokenTitle')}>
      <p>{t('resetPassword.missingToken')}</p>
      <AuthLink href={authRoutes.forgotPassword()}>{t('resetPassword.requestNew')}</AuthLink>
    </StatusNotice>
  );
}
