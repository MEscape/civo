import { buttonVariants } from '@components/ui/button';
import { AlertTriangle } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthPanel } from './auth-panel';

/**
 * Shown instead of the reset form when the page was opened without a usable
 * token (an incomplete link, or a hand-typed URL). A Server Component.
 */
export async function ResetPasswordLinkMissing() {
  const t = await getTranslations('auth');

  return (
    <AuthPanel
      icon={AlertTriangle}
      tone="warning"
      title={t('resetPassword.missingTokenTitle')}
      description={t('resetPassword.missingToken')}
    >
      <Link
        href={authRoutes.forgotPassword()}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t('resetPassword.requestNew')}
      </Link>
    </AuthPanel>
  );
}
