import { buttonVariants } from '@components/ui/button';
import { AlertTriangle } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthPanel } from './auth-panel';

/**
 * Shown instead of the form when the invitation link is unknown, already
 * used or expired: all three look alike, and the fix is the same, a new
 * invitation. A Server Component.
 */
export async function InvitationLinkInvalid() {
  const t = await getTranslations('auth');

  return (
    <AuthPanel
      icon={AlertTriangle}
      tone="warning"
      title={t('acceptInvitation.invalidTitle')}
      description={t('acceptInvitation.invalid')}
    >
      <Link
        href={authRoutes.signIn()}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t('acceptInvitation.signInLink')}
      </Link>
    </AuthPanel>
  );
}
